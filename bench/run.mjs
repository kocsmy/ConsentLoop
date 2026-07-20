/**
 * ConsentLoop performance bench — cookiebench-style methodology, locally reproducible.
 *
 *   node bench/run.mjs [--runs 7] [--cpu 4]
 *
 * Scenarios (all against the same static landing page):
 *   baseline    no consent tooling at all
 *   first       smart loader, first visit (banner renders)
 *   returning   smart loader, valid consent cookie (fast path: no UI download)
 *   full        single-file widget with data-auto (worst case)
 *
 * Metrics per run (median over N runs, 4x CPU throttle): FCP, LCP, CLS, TBT,
 * DOMContentLoaded, load, time-to-banner, consent JS transferred, extra requests.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? +args[i + 1] : dflt;
};
const RUNS = arg("--runs", 7);
const CPU = arg("--cpu", 4);
const PORT = 4321;

function findChromium() {
  const envPath = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (existsSync(join(envPath, "chromium"))) return join(envPath, "chromium");
  try {
    for (const dir of readdirSync(envPath)) {
      const candidates = [
        join(envPath, dir, "chrome-linux", "chrome"),
        join(envPath, dir, "chrome-linux", "headless_shell"),
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  } catch {}
  return undefined;
}

const SCENARIOS = [
  { key: "baseline", path: "/bench/pages/baseline.html" },
  { key: "first", path: "/bench/pages/consentloop-first.html" },
  { key: "returning", path: "/bench/pages/consentloop-returning.html", cookie: true },
  { key: "full", path: "/bench/pages/consentloop-full.html" },
];

const INIT = `
  window.__cls = 0;
  window.__tbt = 0;
  window.__lcp = 0;
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; }))
    .observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__tbt += Math.max(0, e.duration - 50); }))
    .observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__lcp = e.startTime; }))
    .observe({ type: "largest-contentful-paint", buffered: true });
`;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function measure(browser, scenario) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (scenario.cookie) {
    const record = {
      id: "bench-visitor",
      t: new Date().toISOString(),
      u: new Date().toISOString(),
      r: 0,
      a: ["necessary", "analytics", "marketing"],
      j: [],
      g: "gdpr",
      m: "explicit",
      v: "0.1.0",
    };
    await context.addCookies([
      { name: "cl_consent", value: encodeURIComponent(JSON.stringify(record)), url: `http://localhost:${PORT}` },
    ]);
  }
  await context.addInitScript(INIT);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

  await page.goto(`http://localhost:${PORT}${scenario.path}`, { waitUntil: "load" });
  // allow deferred/idle work (banner render, lazy widget fetch) to finish
  await page.waitForTimeout(1600);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    const banner = performance.getEntriesByName("consentloop:banner-visible")[0];
    const resources = performance.getEntriesByType("resource");
    const consentRes = resources.filter((r) => /consentloop/.test(r.name));
    return {
      fcp: paint ? paint.startTime : 0,
      lcp: window.__lcp || 0,
      cls: window.__cls,
      tbt: window.__tbt,
      dcl: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      banner: banner ? banner.startTime : null,
      consentBytes: consentRes.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0),
      consentRequests: consentRes.length,
      totalRequests: resources.length,
      bannerVisible: !!document.getElementById("consentloop"),
    };
  });
  await context.close();
  return m;
}

async function main() {
  const server = spawn("node", [join(root, "scripts/serve.mjs"), root, String(PORT)], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 500));

  const executablePath = findChromium();
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  console.log(`chromium: ${executablePath || "(playwright default)"} · runs=${RUNS} · cpu=${CPU}x\n`);

  const results = {};
  for (const scenario of SCENARIOS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, scenario));
    const agg = {};
    for (const key of ["fcp", "lcp", "cls", "tbt", "dcl", "load", "consentBytes", "consentRequests"]) {
      agg[key] = +median(runs.map((r) => r[key] ?? 0)).toFixed(key === "cls" ? 4 : 1);
    }
    const banners = runs.map((r) => r.banner).filter((b) => b != null);
    agg.banner = banners.length ? +median(banners).toFixed(1) : null;
    results[scenario.key] = agg;
    console.log(scenario.key.padEnd(10), JSON.stringify(agg));
  }

  await browser.close();
  server.kill();

  const base = results.baseline;
  const delta = (s, k) => +(results[s][k] - base[k]).toFixed(1);
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    runs: RUNS,
    cpuThrottle: CPU,
    scenarios: results,
    deltas: Object.fromEntries(
      ["first", "returning", "full"].map((s) => [
        s,
        { fcp: delta(s, "fcp"), lcp: delta(s, "lcp"), dcl: delta(s, "dcl"), load: delta(s, "load"), cls: results[s].cls, tbt: results[s].tbt, consentKB: +(results[s].consentBytes / 1024).toFixed(2), banner: results[s].banner },
      ])
    ),
  };
  mkdirSync(join(root, "bench/results"), { recursive: true });
  writeFileSync(join(root, "bench/results/results.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(root, "site/bench-results.json"), JSON.stringify(summary, null, 2));

  console.log("\nΔ vs baseline (median):");
  console.table(summary.deltas);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
