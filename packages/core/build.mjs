import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync } from "node:fs";

const banner = `/*! consentloop v0.1.0 | MIT | https://github.com/kocsmy/ConsentLoop */`;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const common = {
  bundle: true,
  target: ["es2019", "chrome80", "firefox78", "safari13.1"],
  banner: { js: banner },
  legalComments: "none",
  logLevel: "silent",
};

// 1) ESM for bundlers — code-split so the UI chunk loads only when a banner must render.
await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  minify: false,
});

// 2) Single-file minified ESM (CDN <script type="module">).
await build({
  ...common,
  entryPoints: { "index.min": "src/index.ts" },
  outdir: "dist",
  format: "esm",
  minify: true,
});

// 3) Classic global build (window.ConsentLoop + data-auto).
await build({
  ...common,
  entryPoints: { "consentloop.iife.min": "src/iife.ts" },
  outdir: "dist",
  format: "iife",
  minify: true,
});

// 4) Smart loader — sub-1KB critical-path entry.
await build({
  ...common,
  entryPoints: { "consentloop.loader.min": "src/loader.ts" },
  outdir: "dist",
  format: "iife",
  minify: true,
});

// ship the config schema with the package (consentloop/schema.json)
copyFileSync("../../schema/consentloop.schema.json", "schema.json");

const report = {};
for (const file of ["consentloop.loader.min.js", "index.min.js", "consentloop.iife.min.js"]) {
  const buf = readFileSync(`dist/${file}`);
  report[file] = { bytes: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
}
// initial (pre-UI) cost of the split ESM entry
{
  const buf = readFileSync("dist/index.js");
  report["index.js (unminified entry, UI in lazy chunk)"] = {
    bytes: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    chunks: readdirSync("dist/chunks").length,
  };
}
writeFileSync("dist/size-report.json", JSON.stringify(report, null, 2));
for (const [file, s] of Object.entries(report)) {
  console.log(`${file}: ${(s.bytes / 1024).toFixed(1)} KB, gzip ${(s.gzip / 1024).toFixed(2)} KB`);
}
