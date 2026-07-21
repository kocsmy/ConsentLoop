import { describe, it, expect, afterEach, vi } from "vitest";
import { api } from "../src/index";
import {
  cleanup,
  q,
  maybeQ,
  click,
  bannerVisible,
  prefsVisible,
  storedCookie,
  root,
} from "./helpers";

afterEach(cleanup);

const flush = () => new Promise((r) => setTimeout(r, 5));

describe("run() — first visit (GDPR)", () => {
  it("renders the banner in a shadow root and blocks gated scripts", async () => {
    document.body.innerHTML = `<script type="text/plain" data-consent="analytics" data-consent-src="https://x.test/a.js"></script>`;
    await api.run({ categories: { necessary: { required: true }, analytics: {} } });
    expect(document.getElementById("consentloop")?.shadowRoot).toBeTruthy();
    expect(bannerVisible()).toBe(true);
    expect(document.querySelector("script[src]")).toBeNull();
    expect(api.hasConsent()).toBe(false);
    expect(api.getConsent()).toBeNull();
  });

  it("accept-all persists, activates scripts, fires hooks and events", async () => {
    document.body.innerHTML = `<script type="text/plain" data-consent="analytics" data-consent-src="https://x.test/a.js"></script>`;
    const onFirstConsent = vi.fn();
    const onConsent = vi.fn();
    const onChange = vi.fn();
    const domEvent = vi.fn();
    window.addEventListener("consentloop:consent", domEvent);
    await api.run({
      categories: { necessary: { required: true }, analytics: {} },
      hooks: { onFirstConsent, onConsent, onChange },
    });
    click('[data-a="accept-all"]');
    expect(bannerVisible()).toBe(false);
    expect(api.isAccepted("analytics")).toBe(true);
    expect(api.hasConsent()).toBe(true);
    expect(document.querySelector("script[src='https://x.test/a.js']")).toBeTruthy();
    expect(onFirstConsent).toHaveBeenCalledTimes(1);
    expect(onConsent).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(domEvent).toHaveBeenCalled();
    const stored = storedCookie()!;
    expect(stored.a).toContain("analytics");
    expect(stored.m).toBe("explicit");
    window.removeEventListener("consentloop:consent", domEvent);
  });

  it("reject-all stores only required categories", async () => {
    await api.run({ categories: { necessary: { required: true }, analytics: {}, marketing: {} } });
    click('[data-a="reject-all"]');
    expect(api.acceptedCategories()).toEqual(["necessary"]);
    expect(api.isAccepted("analytics")).toBe(false);
    expect(storedCookie()!.j).toEqual(["analytics", "marketing"]);
  });
});

describe("preferences", () => {
  it("opens from banner, saves a partial choice with services", async () => {
    await api.run({
      categories: {
        necessary: { required: true },
        analytics: { services: { ga4: { label: "Google Analytics" }, hotjar: {} } },
        marketing: {},
      },
    });
    click('[data-a="open-prefs"]');
    expect(prefsVisible()).toBe(true);
    expect(bannerVisible()).toBe(false);

    // turn analytics on, then hotjar off
    click('[data-cat="analytics"]:not([data-svc])');
    click('[data-cat="analytics"][data-svc="hotjar"]');
    click('[data-a="save"]');

    expect(prefsVisible()).toBe(false);
    expect(api.isAccepted("analytics")).toBe(true);
    expect(api.isAccepted("marketing")).toBe(false);
    expect(api.isServiceAccepted("analytics", "ga4")).toBe(true);
    expect(api.isServiceAccepted("analytics", "hotjar")).toBe(false);
  });

  it("service switch drives category switch", async () => {
    await api.run({
      categories: { necessary: { required: true }, analytics: { services: { ga4: {}, hotjar: {} } } },
    });
    click('[data-a="open-prefs"]');
    click('[data-cat="analytics"][data-svc="ga4"]');
    expect(q('[data-cat="analytics"]:not([data-svc])').getAttribute("aria-checked")).toBe("true");
    click('[data-cat="analytics"][data-svc="ga4"]');
    expect(q('[data-cat="analytics"]:not([data-svc])').getAttribute("aria-checked")).toBe("false");
  });

  it("closing without a choice returns to the banner", async () => {
    await api.run({});
    click('[data-a="open-prefs"]');
    click('[data-a="close-prefs"]');
    expect(prefsVisible()).toBe(false);
    expect(bannerVisible()).toBe(true);
  });

  it("Escape closes preferences but not the banner under GDPR", async () => {
    await api.run({});
    click('[data-a="open-prefs"]');
    const host = document.getElementById("consentloop")!;
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(prefsVisible()).toBe(false);
    expect(bannerVisible()).toBe(true);
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(bannerVisible()).toBe(true); // GDPR: no silent dismissal
  });
});

describe("returning visitor", () => {
  it("applies consent without rendering any UI", async () => {
    await api.run({ categories: { analytics: {} } });
    click('[data-a="accept-all"]');
    api.destroy();
    document.body.innerHTML = `<script type="text/plain" data-consent="analytics" data-consent-src="https://x.test/a.js"></script>`;

    const onConsent = vi.fn();
    await api.run({ categories: { analytics: {} }, hooks: { onConsent } });
    await flush();
    expect(document.getElementById("consentloop")).toBeNull(); // fast path: zero UI
    expect(document.querySelector("script[src='https://x.test/a.js']")).toBeTruthy();
    expect(onConsent).toHaveBeenCalledTimes(1);
    expect(api.hasConsent()).toBe(true);
  });

  it("re-prompts when the revision changes and keeps working after update", async () => {
    await api.run({ categories: { analytics: {} } });
    click('[data-a="accept-all"]');
    api.destroy();

    await api.run({ categories: { analytics: {} }, storage: { revision: 3 } });
    expect(bannerVisible()).toBe(true);
    click('[data-a="accept-all"]');
    expect(storedCookie()!.r).toBe(3);
  });
});

describe("withdrawal & autoClear", () => {
  it("clears configured cookies when a category is withdrawn", async () => {
    document.cookie = "_ga=1; Path=/";
    document.cookie = "_ga_M1=1; Path=/";
    document.cookie = "unrelated=1; Path=/";
    const onChange = vi.fn();
    await api.run({
      categories: { necessary: { required: true }, analytics: { autoClear: [/^_ga/] } },
      hooks: { onChange },
    });
    click('[data-a="accept-all"]');
    expect(document.cookie).toContain("_ga=1");

    api.showPreferences();
    await flush();
    click('[data-cat="analytics"]:not([data-svc])'); // toggle off
    click('[data-a="save"]');

    expect(api.isAccepted("analytics")).toBe(false);
    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).not.toContain("_ga_M1=");
    expect(document.cookie).toContain("unrelated=1");
    expect(onChange).toHaveBeenCalledWith(expect.anything(), ["analytics"]);
  });

  it("fires service onAccept/onReject", async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    await api.run({
      categories: { analytics: { services: { ga4: { onAccept, onReject } } } },
    });
    click('[data-a="accept-all"]');
    expect(onAccept).toHaveBeenCalledTimes(1);
    api.rejectAll();
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});

describe("headless mode", () => {
  it("ui: false renders nothing but the API drives consent", async () => {
    const ready = vi.fn();
    await api.run({ ui: false, categories: { analytics: {} } });
    api.on("ready", ready); // subscribing after run — use event emitted state instead
    expect(document.getElementById("consentloop")).toBeNull();
    api.accept(["analytics"]);
    expect(api.isAccepted("analytics")).toBe(true);
    expect(storedCookie()).toBeTruthy();
  });
});

describe("us-optout preset", () => {
  it("applies defaults immediately while still showing the banner", async () => {
    document.body.innerHTML = `<script type="text/plain" data-consent="analytics" data-consent-src="https://x.test/a.js"></script>`;
    await api.run({
      regulation: "us-optout",
      categories: { necessary: { required: true }, analytics: { default: true } },
    });
    expect(bannerVisible()).toBe(true);
    expect(api.isAccepted("analytics")).toBe(true); // implied
    expect(api.hasConsent()).toBe(false); // not persisted yet
    expect(document.querySelector("script[src='https://x.test/a.js']")).toBeTruthy();
    expect(api.getConsent()?.method).toBe("implied");
  });

  it("Escape dismisses and persists the implied choice", async () => {
    await api.run({ regulation: "us-optout", categories: { analytics: { default: true } } });
    const host = document.getElementById("consentloop")!;
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(bannerVisible()).toBe(false);
    expect(api.hasConsent()).toBe(true);
    expect(storedCookie()!.m).toBe("implied");
  });
});

describe("adapter", () => {
  it("show:false decision suppresses the banner and implies full consent", async () => {
    await api.run({
      categories: { analytics: {} },
      adapter: { init: () => ({ show: false }) },
    });
    expect(document.getElementById("consentloop")).toBeNull();
    expect(api.isAccepted("analytics")).toBe(true);
    expect(api.getConsent()?.method).toBe("implied");
  });

  it("adapter.persist receives every explicit choice", async () => {
    const persist = vi.fn();
    await api.run({ categories: { analytics: {} }, adapter: { persist } });
    click('[data-a="accept-all"]');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0]![0].accepted).toContain("analytics");
  });

  it("a hanging adapter never blocks the banner", async () => {
    await api.run({
      categories: { analytics: {} },
      manage: { endpoint: "https://api.test", timeout: 30 },
      adapter: { init: () => new Promise(() => undefined) },
    });
    expect(bannerVisible()).toBe(true);
  });
});

describe("reset & floating button", () => {
  it("reset erases and re-prompts", async () => {
    await api.run({ categories: { analytics: {} } });
    click('[data-a="accept-all"]');
    expect(api.hasConsent()).toBe(true);
    api.reset();
    await flush();
    expect(api.hasConsent()).toBe(false);
    expect(storedCookie()).toBeNull();
    expect(bannerVisible()).toBe(true);
  });

  it("floating button appears after consent when enabled", async () => {
    await api.run({ ui: { floatingButton: true }, categories: { analytics: {} } });
    click('[data-a="accept-all"]');
    const fabLayer = maybeQ('[data-l="fab"]');
    expect(fabLayer?.classList.contains("cl-on")).toBe(true);
  });
});

describe("a11y & security", () => {
  it("escapes user-provided button labels but allows HTML in descriptions", async () => {
    await api.run({
      content: {
        translations: {
          en: {
            banner: {
              title: "<img src=x onerror=alert(1)>",
              description: 'Read our <a href="/privacy">policy</a>',
              acceptAll: "<b>Yes</b>",
            },
          },
        },
      },
    });
    expect(q(".cl-title").innerHTML).not.toContain("<img");
    expect(q(".cl-desc").querySelector("a")).toBeTruthy();
    expect(q('[data-a="accept-all"]').innerHTML).not.toContain("<b>");
  });

  it("an empty banner title is omitted and the dialog falls back to labelling by its description", async () => {
    await api.run({
      content: { translations: { en: { banner: { title: "", description: "Custom description text" } } } },
    });
    expect(maybeQ(".cl-banner .cl-title")).toBeNull();
    const desc = q(".cl-desc");
    expect(desc.id).toBe("cl-desc");
    expect(q(".cl-banner").getAttribute("aria-labelledby")).toBe("cl-desc");
    expect(q(".cl-banner").hasAttribute("aria-label")).toBe(false);
  });

  it("preferences dialog has aria-modal and switches expose role/aria-checked", async () => {
    await api.run({ categories: { analytics: {} } });
    click('[data-a="open-prefs"]');
    expect(q(".cl-prefs").getAttribute("aria-modal")).toBe("true");
    const sw = q('[data-cat="analytics"]');
    expect(sw.getAttribute("role")).toBe("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("run() is idempotent", async () => {
    await api.run({});
    await api.run({});
    expect(root().querySelectorAll(".cl-banner").length).toBe(1);
  });
});

describe("branding, legal links & UI behavior options", () => {
  it("shows the branding credit in banner and preferences by default", async () => {
    await api.run({ categories: { necessary: { required: true }, analytics: {} } });
    expect(maybeQ(".cl-banner .cl-brand")).toBeTruthy();
    click('[data-a="open-prefs"]');
    expect(maybeQ(".cl-prefs .cl-legal .cl-brand")).toBeTruthy();
  });

  it("ui.branding:false hides the credit everywhere", async () => {
    await api.run({ categories: { necessary: { required: true } }, ui: { branding: false } });
    expect(maybeQ(".cl-brand")).toBeNull();
  });

  it("shows the credit inline in the links row for cloud and bar layouts", async () => {
    for (const layout of ["cloud", "bar"] as const) {
      await api.run({ categories: { necessary: { required: true } }, ui: { layout } });
      expect(maybeQ(".cl-banner .cl-links .cl-brand")).toBeTruthy();
      expect(maybeQ(".cl-banner > .cl-brand")).toBeNull();
      api.destroy();
    }
    // box keeps the credit on its own line after the actions
    await api.run({ categories: { necessary: { required: true } } });
    expect(maybeQ(".cl-banner > .cl-brand")).toBeTruthy();
    expect(maybeQ(".cl-banner .cl-links")).toBeNull();
  });

  it("hiding reject-all marks the actions row solo so the accept button hugs its label", async () => {
    await api.run({ categories: { necessary: { required: true } }, ui: { showRejectAll: false } });
    expect(maybeQ(".cl-actions.cl-solo")).toBeTruthy();
    api.destroy();
    // with both buttons present they share the row — no solo sizing
    await api.run({ categories: { necessary: { required: true } } });
    expect(maybeQ(".cl-actions.cl-solo")).toBeNull();
    expect(maybeQ(".cl-actions")).toBeTruthy();
  });

  it("reset(true) while preferences are open closes them before re-prompting", async () => {
    await api.run({ categories: { necessary: { required: true }, analytics: {} } });
    click('[data-a="open-prefs"]');
    expect(prefsVisible()).toBe(true);
    api.reset(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(prefsVisible()).toBe(false);
    expect(bannerVisible()).toBe(true);
  });

  it("cloud layout renders configured legal links (not suppressed)", async () => {
    await api.run({
      categories: { necessary: { required: true } },
      ui: { layout: "cloud", branding: false },
      content: { privacyPolicyUrl: "https://x.test/privacy" },
    });
    expect(maybeQ('.cl-banner .cl-links a[href="https://x.test/privacy"]')).toBeTruthy();
  });

  it("renders localized privacy policy + terms links in banner and preferences", async () => {
    await api.run({
      categories: { necessary: { required: true }, analytics: {} },
      content: { privacyPolicyUrl: "/privacy", termsUrl: "/terms" },
    });
    const anchors = q(".cl-banner .cl-links").querySelectorAll("a");
    expect(anchors[0]!.getAttribute("href")).toBe("/privacy");
    expect(anchors[0]!.textContent).toBe("Privacy policy");
    expect(anchors[1]!.getAttribute("href")).toBe("/terms");
    expect(anchors[1]!.textContent).toBe("Terms & conditions");
    click('[data-a="open-prefs"]');
    expect(maybeQ(".cl-legal a[href='/privacy']")).toBeTruthy();
    expect(maybeQ(".cl-legal a[href='/terms']")).toBeTruthy();
  });

  it("legal link labels use the active language", async () => {
    document.documentElement.lang = "de";
    await api.run({
      categories: { necessary: { required: true } },
      content: {
        privacyPolicyUrl: "/privacy",
        translations: { de: { banner: { privacyPolicy: "Datenschutzerklärung" } } },
      },
    });
    expect(q(".cl-links a").textContent).toBe("Datenschutzerklärung");
    document.documentElement.lang = "";
  });

  it("custom banner links render after the legal links", async () => {
    await api.run({
      categories: { necessary: { required: true } },
      content: {
        termsUrl: "/terms",
        translations: { en: { banner: { links: [{ label: "Imprint", href: "/imprint" }] } } },
      },
    });
    const anchors = q(".cl-links").querySelectorAll("a");
    expect([...anchors].map((a) => a.getAttribute("href"))).toEqual(["/terms", "/imprint"]);
  });

  it("ui.scrollLock freezes page scroll while a layer is open and restores it after", async () => {
    document.documentElement.style.overflow = "auto";
    await api.run({ categories: { necessary: { required: true }, analytics: {} }, ui: { scrollLock: true } });
    expect(document.documentElement.style.overflow).toBe("hidden");
    click('[data-a="accept-all"]');
    expect(document.documentElement.style.overflow).toBe("auto");
    document.documentElement.style.overflow = "";
  });

  it("without ui.scrollLock the page scroll is untouched", async () => {
    document.documentElement.style.overflow = "auto";
    await api.run({ categories: { necessary: { required: true }, analytics: {} } });
    expect(document.documentElement.style.overflow).toBe("auto");
    document.documentElement.style.overflow = "";
  });

  it("ui.customCss is injected inside the widget root after the base styles", async () => {
    await api.run({
      categories: { necessary: { required: true } },
      ui: { customCss: ".cl-banner{border-width:9px}" },
    });
    const shadow = document.getElementById("consentloop")!.shadowRoot!;
    const styles = [...shadow.querySelectorAll("style")].map((s) => s.textContent).join("");
    expect(styles).toContain("border-width:9px");
    expect(styles.indexOf("border-width:9px")).toBeGreaterThan(styles.indexOf(".cl-root"));
  });
});

describe("Global Privacy Control (us-optout)", () => {
  const setGPC = (v: boolean | undefined) => {
    if (v === undefined) {
      delete (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl;
    } else {
      Object.defineProperty(navigator, "globalPrivacyControl", { value: v, configurable: true });
    }
  };
  afterEach(() => setGPC(undefined));

  it("GPC visitors are auto-opted-out: no optional grants, no banner", async () => {
    setGPC(true);
    await api.run({
      regulation: "us-optout",
      categories: { necessary: { required: true }, analytics: { default: true }, marketing: { default: true } },
    });
    // stronger than "banner hidden": GPC visitors never even mount the widget
    expect(document.getElementById("consentloop")).toBeNull();
    expect(api.isAccepted("necessary")).toBe(true);
    expect(api.isAccepted("analytics")).toBe(false);
    expect(api.isAccepted("marketing")).toBe(false);
    expect(api.getConsent()?.method).toBe("implied");
  });

  it("respectGPC:false ignores the signal", async () => {
    setGPC(true);
    await api.run({
      regulation: "us-optout",
      respectGPC: false,
      categories: { necessary: { required: true }, analytics: { default: true } },
    });
    expect(bannerVisible()).toBe(true);
    expect(api.isAccepted("analytics")).toBe(true);
  });

  it("GPC has no effect under gdpr", async () => {
    setGPC(true);
    await api.run({ categories: { necessary: { required: true }, analytics: {} } });
    expect(bannerVisible()).toBe(true);
    expect(api.getConsent()).toBeNull();
  });
});

describe("cookie policy link", () => {
  it("renders the localized cookie policy link between privacy and terms", async () => {
    await api.run({
      categories: { necessary: { required: true } },
      content: { privacyPolicyUrl: "/privacy", cookiePolicyUrl: "/cookies", termsUrl: "/terms" },
    });
    const anchors = [...q(".cl-banner .cl-links").querySelectorAll("a")];
    expect(anchors.map((a) => a.textContent)).toEqual(["Privacy policy", "Cookie policy", "Terms & conditions"]);
    expect(anchors[1]!.getAttribute("href")).toBe("/cookies");
  });
});
