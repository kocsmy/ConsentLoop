import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { gcmDefault, gcmUpdate } from "../src/gcm";
import { resolveConfig, buildRecord } from "../src/store";
import { cleanup } from "./helpers";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

beforeEach(() => {
  window.dataLayer = undefined;
});
afterEach(cleanup);

const last = (): Record<string, string> => {
  const args = window.dataLayer![window.dataLayer!.length - 1] as IArguments;
  return args[2] as Record<string, string>;
};

describe("Google Consent Mode v2", () => {
  it("pushes denied defaults (except security) with wait_for_update", () => {
    const cfg = resolveConfig({ googleConsentMode: true });
    gcmDefault(cfg, null);
    const state = last();
    expect(state.analytics_storage).toBe("denied");
    expect(state.ad_storage).toBe("denied");
    expect(state.ad_user_data).toBe("denied");
    expect(state.security_storage).toBe("granted");
    expect((state as Record<string, unknown>).wait_for_update).toBe(500);
    const args = window.dataLayer![0] as IArguments;
    expect(args[0]).toBe("consent");
    expect(args[1]).toBe("default");
  });

  it("bakes stored consent into defaults", () => {
    const cfg = resolveConfig({ categories: { analytics: {}, marketing: {} }, googleConsentMode: true });
    const rec = buildRecord(["analytics"], {}, cfg, null, "explicit");
    gcmDefault(cfg, rec);
    const state = last();
    expect(state.analytics_storage).toBe("granted");
    expect(state.ad_storage).toBe("denied");
  });

  it("update reflects the record and custom maps", () => {
    const cfg = resolveConfig({
      categories: { analytics: {}, embeds: {} },
      googleConsentMode: { map: { analytics: ["analytics_storage"], embeds: ["ad_storage"] } },
    });
    gcmUpdate(buildRecord(["embeds"], {}, cfg, null, "explicit"), cfg);
    const state = last();
    expect(state.ad_storage).toBe("granted");
    expect(state.analytics_storage).toBe("denied");
    const args = window.dataLayer![0] as IArguments;
    expect(args[1]).toBe("update");
  });

  it("does nothing when disabled", () => {
    const cfg = resolveConfig({});
    gcmDefault(cfg, null);
    expect(window.dataLayer).toBeUndefined();
  });
});
