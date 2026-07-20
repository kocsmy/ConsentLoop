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
