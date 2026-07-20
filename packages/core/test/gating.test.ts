import { describe, it, expect, afterEach } from "vitest";
import { activateGated } from "../src/gating";
import { cleanup } from "./helpers";

afterEach(cleanup);

const accept =
  (cats: string[], services?: Record<string, string[]>) =>
  ({
    isAccepted: (cat: string, svc?: string) => {
      if (!cats.includes(cat)) return false;
      if (!svc || !services) return true;
      const list = services[cat];
      return !list || list.includes(svc);
    },
  });

describe("script gating", () => {
  it("activates external scripts for accepted categories only", () => {
    document.body.innerHTML = `
      <script type="text/plain" data-consent="analytics" data-consent-src="https://x.test/a.js" async></script>
      <script type="text/plain" data-consent="marketing" data-consent-src="https://x.test/m.js"></script>`;
    const n = activateGated(accept(["analytics"]));
    expect(n).toBe(1);
    const live = document.querySelector("script[src='https://x.test/a.js']") as HTMLScriptElement;
    expect(live).toBeTruthy();
    expect(live.getAttribute("type")).toBeNull();
    expect(live.hasAttribute("async")).toBe(true);
    expect(live.hasAttribute("data-consent")).toBe(false);
    expect(live.hasAttribute("data-consent-activated")).toBe(true);
    // marketing stays blocked
    expect(document.querySelector("script[type='text/plain'][data-consent='marketing']")).toBeTruthy();
  });

  it("activates inline scripts preserving content", () => {
    document.body.innerHTML = `<script type="text/plain" data-consent="analytics">window.__x=1</script>`;
    activateGated(accept(["analytics"]));
    const live = document.querySelector("script:not([type])");
    expect(live?.textContent).toBe("window.__x=1");
  });

  it("respects data-consent-service granularity", () => {
    document.body.innerHTML = `
      <script type="text/plain" data-consent="analytics" data-consent-service="ga4" data-consent-src="https://x.test/ga.js"></script>
      <script type="text/plain" data-consent="analytics" data-consent-service="hotjar" data-consent-src="https://x.test/hj.js"></script>`;
    activateGated(accept(["analytics"], { analytics: ["ga4"] }));
    expect(document.querySelector("script[src='https://x.test/ga.js']")).toBeTruthy();
    expect(document.querySelector("script[src='https://x.test/hj.js']")).toBeNull();
  });

  it("sets src on gated iframes and images", () => {
    document.body.innerHTML = `
      <iframe data-consent="marketing" data-consent-src="https://yt.test/embed/1"></iframe>
      <img data-consent="marketing" data-consent-src="https://px.test/p.gif">`;
    activateGated(accept(["marketing"]));
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe("https://yt.test/embed/1");
    expect(document.querySelector("img")?.getAttribute("src")).toBe("https://px.test/p.gif");
  });

  it("is idempotent — already-activated elements are skipped", () => {
    document.body.innerHTML = `<iframe data-consent="marketing" data-consent-src="https://yt.test/1"></iframe>`;
    expect(activateGated(accept(["marketing"]))).toBe(1);
    expect(activateGated(accept(["marketing"]))).toBe(0);
  });
});
