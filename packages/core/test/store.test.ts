import { describe, it, expect, afterEach } from "vitest";
import { resolveConfig, readStored, isValid, persist, buildRecord } from "../src/store";
import { cleanup, storedCookie } from "./helpers";

afterEach(cleanup);

describe("resolveConfig", () => {
  it("applies sensible defaults", () => {
    const cfg = resolveConfig({});
    expect(cfg.categories.necessary?.required).toBe(true);
    expect(cfg.categories.analytics).toBeDefined();
    expect(cfg.regulation).toBe("gdpr");
    expect(cfg.storage.name).toBe("cl_consent");
    expect(cfg.storage.expiresDays).toBe(182);
    expect(cfg.ui && cfg.ui.layout).toBe("box");
    expect(cfg.ui && cfg.ui.position).toBe("bottom-right");
    expect(cfg.autoScripts).toBe(true);
  });

  it("adds necessary automatically and forces required defaults on", () => {
    const cfg = resolveConfig({ categories: { marketing: {} } });
    expect(cfg.categories.necessary?.required).toBe(true);
    expect(cfg.categories.necessary?.default).toBe(true);
    expect(cfg.categories.marketing?.default).toBe(false);
  });

  it("cloud/bar default to bottom-center", () => {
    expect((resolveConfig({ ui: { layout: "cloud" } }).ui as { position: string }).position).toBe("bottom-center");
  });

  it("googleConsentMode: true expands to default map", () => {
    const cfg = resolveConfig({ googleConsentMode: true });
    expect(cfg.googleConsentMode && cfg.googleConsentMode.map.analytics).toEqual(["analytics_storage"]);
    expect(cfg.googleConsentMode && cfg.googleConsentMode.waitForUpdate).toBe(500);
  });

  it("ui: false stays headless", () => {
    expect(resolveConfig({ ui: false }).ui).toBe(false);
  });
});

describe("records", () => {
  const cfg = resolveConfig({
    categories: { necessary: { required: true }, analytics: { services: { ga4: {}, plausible: {} } }, marketing: {} },
  });

  it("buildRecord grants required + requested, fills services", () => {
    const rec = buildRecord(["analytics"], {}, cfg, null, "explicit");
    expect(rec.accepted.sort()).toEqual(["analytics", "necessary"]);
    expect(rec.rejected).toEqual(["marketing"]);
    expect(rec.services.analytics!.sort()).toEqual(["ga4", "plausible"]);
    expect(rec.method).toBe("explicit");
    expect(rec.id).toMatch(/[0-9a-f-]{36}/);
  });

  it("buildRecord respects partial services", () => {
    const rec = buildRecord(["analytics"], { analytics: ["ga4", "bogus"] }, cfg, null, "explicit");
    expect(rec.services.analytics).toEqual(["ga4"]);
  });

  it("persists and reads back via cookie", () => {
    const rec = buildRecord(["analytics"], {}, cfg, null, "explicit");
    persist(rec, cfg);
    expect(storedCookie()).toBeTruthy();
    const back = readStored(cfg);
    expect(back?.accepted).toEqual(rec.accepted);
    expect(back?.rejected).toEqual(["marketing"]);
    expect(back?.id).toBe(rec.id);
    expect(isValid(back, cfg)).toBe(true);
  });

  it("persists via localStorage when configured", () => {
    const lsCfg = resolveConfig({ storage: { type: "localStorage" } });
    const rec = buildRecord(["analytics"], {}, lsCfg, null, "explicit");
    persist(rec, lsCfg);
    expect(localStorage.getItem("cl_consent")).toBeTruthy();
    expect(readStored(lsCfg)?.accepted).toContain("analytics");
  });

  it("invalidates on revision bump", () => {
    const rec = buildRecord(["analytics"], {}, cfg, null, "explicit");
    persist(rec, cfg);
    const bumped = resolveConfig({ categories: { analytics: {} }, storage: { revision: 1 } });
    expect(isValid(readStored(bumped), bumped)).toBe(false);
  });

  it("invalidates on expiry", () => {
    const rec = buildRecord(["analytics"], {}, cfg, null, "explicit");
    rec.updatedAt = new Date(Date.now() - 200 * 86400_000).toISOString();
    persist(rec, cfg);
    expect(isValid(readStored(cfg), cfg)).toBe(false);
  });

  it("re-prompts under gdpr when a new optional category appears", () => {
    const rec = buildRecord(["analytics"], {}, cfg, null, "explicit");
    persist(rec, cfg);
    const grown = resolveConfig({
      categories: { necessary: { required: true }, analytics: {}, marketing: {}, embeds: {} },
    });
    expect(isValid(readStored(grown), grown)).toBe(false);
    // ...but a new *required* category does not re-prompt
    const grownRequired = resolveConfig({
      categories: { necessary: { required: true }, analytics: {}, marketing: {}, cdn: { required: true } },
    });
    expect(isValid(readStored(grownRequired), grownRequired)).toBe(true);
  });

  it("keeps id + firstAt across updates", () => {
    const first = buildRecord(["analytics"], {}, cfg, null, "explicit");
    const second = buildRecord([], {}, cfg, first, "explicit");
    expect(second.id).toBe(first.id);
    expect(second.firstAt).toBe(first.firstAt);
    expect(second.accepted).toEqual(["necessary"]);
  });
});
