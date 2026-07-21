import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveI18n } from "../src/i18n";
import { resolveConfig } from "../src/store";
import { api } from "../src/index";
import { cleanup, q, click } from "./helpers";

afterEach(cleanup);

describe("i18n", () => {
  it("falls back to built-in English", async () => {
    const { lang, t } = await resolveI18n(resolveConfig({}));
    expect(lang).toBeTruthy();
    expect(t.banner!.acceptAll).toBe("Accept all");
  });

  it("detects from <html lang> and merges partial translations", async () => {
    document.documentElement.lang = "de-DE";
    const cfg = resolveConfig({
      content: { translations: { de: { banner: { acceptAll: "Alle akzeptieren" } } } },
    });
    const { lang, t } = await resolveI18n(cfg);
    expect(lang).toBe("de");
    expect(t.banner!.acceptAll).toBe("Alle akzeptieren");
    expect(t.banner!.rejectAll).toBe("Reject all"); // merged fallback
  });

  it("fetches URL translations lazily and caches them", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ banner: { acceptAll: "Tout accepter" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const cfg = resolveConfig({ content: { lang: "fr", translations: { fr: "/i18n/fr.json" } } });
    const one = await resolveI18n(cfg);
    expect(one.t.banner!.acceptAll).toBe("Tout accepter");
    await resolveI18n(cfg);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached after first load
  });

  it("setLanguage re-renders the widget live", async () => {
    await api.run({
      content: {
        translations: {
          en: {},
          hu: { banner: { title: "Fontos nekünk az adatvédelem", acceptAll: "Összes elfogadása" } },
        },
      },
    });
    expect(q('[data-a="accept-all"]').textContent).toBe("Accept all");
    await api.setLanguage("hu");
    expect(q('[data-a="accept-all"]').textContent).toBe("Összes elfogadása");
    // interactions still work after re-render
    click('[data-a="accept-all"]');
    expect(api.hasConsent()).toBe(true);
  });

  it("rtl translations set dir on the root", async () => {
    await api.run({ content: { lang: "ar", translations: { ar: { rtl: true } } } });
    const host = document.getElementById("consentloop")!;
    expect(host.shadowRoot!.querySelector(".cl-root")!.getAttribute("dir")).toBe("rtl");
  });
});

describe("locale packs", () => {
  it("every pack listed in index.json exists and is complete", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname, "../locales");
    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as {
      code: string; name: string; rtl: boolean;
    }[];
    expect(index.length).toBe(58);
    for (const { code } of index) {
      const pack = JSON.parse(readFileSync(join(dir, `${code}.json`), "utf8"));
      for (const key of ["title", "description", "acceptAll", "rejectAll", "preferences", "privacyPolicy", "cookiePolicy", "terms"]) {
        expect(pack.banner?.[key], `${code}: banner.${key}`).toBeTruthy();
      }
      for (const key of ["title", "description", "save", "alwaysOn"]) {
        expect(pack.preferences?.[key], `${code}: preferences.${key}`).toBeTruthy();
      }
      expect(Object.keys(pack.categories || {}).sort()).toEqual(["analytics", "functionality", "marketing", "necessary"]);
    }
  });
});
