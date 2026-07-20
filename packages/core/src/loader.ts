/**
 * ConsentLoop smart loader — the sub-1KB entry point.
 *
 *   <script defer src="https://.../consentloop.loader.min.js"
 *           data-gcm data-revision="0"></script>
 *
 * What it does, in order:
 *  1. Reads stored consent synchronously (cookie `cl_consent` by default).
 *  2. Pushes Google Consent Mode defaults (`data-gcm`) before any Google tag runs.
 *  3. Valid consent → activates `<script type="text/plain" data-consent>` and
 *     `[data-consent-src]` elements immediately. The full widget is downloaded
 *     ONLY if `window.consentloopConfig` exists (for hooks) — otherwise never.
 *  4. No valid consent → lazily loads the full widget after idle to show the banner.
 *  5. Installs a proxy `window.ConsentLoop` so any API call (e.g. showPreferences())
 *     transparently loads the full widget first.
 *
 * Attributes: data-src (full bundle URL; defaults to consentloop.iife.min.js next
 * to the loader), data-name (storage key), data-revision, data-expires-days,
 * data-gcm (enable Consent Mode), data-storage="local" (localStorage).
 */

interface StoredMini {
  a?: string[];
  s?: Record<string, string[]>;
  u?: string;
  t?: string;
  r?: number;
}

(() => {
  const d = document;
  const w = window as unknown as Record<string, unknown>;
  const me = d.currentScript as HTMLScriptElement | null;
  const attr = (name: string): string | null => (me ? me.getAttribute("data-" + name) : null);

  const name = attr("name") || "cl_consent";
  const revision = +(attr("revision") || 0);
  const days = +(attr("expires-days") || 182);
  const fullSrc = attr("src") || (me ? me.src.replace(/[^/]*$/, "consentloop.iife.min.js") : "consentloop.iife.min.js");

  // -- read stored consent ------------------------------------------------
  let stored: StoredMini | null = null;
  try {
    let raw: string | null = null;
    if (attr("storage") === "local") raw = localStorage.getItem(name);
    else {
      const m = d.cookie.match(new RegExp("(?:^|;\\s*)" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"));
      raw = m ? decodeURIComponent(m[1]!) : null;
    }
    if (raw) stored = JSON.parse(raw) as StoredMini;
  } catch {
    stored = null;
  }
  const fresh =
    stored &&
    Array.isArray(stored.a) &&
    (stored.r || 0) === revision &&
    Date.now() - Date.parse(stored.u || stored.t || "") < days * 864e5;
  const accepted: string[] = fresh ? stored!.a! : [];

  // -- Google Consent Mode defaults (must beat Google tags) ---------------
  const cfg = w.consentloopConfig as Record<string, unknown> | undefined;
  const gcmCfg = cfg && cfg.googleConsentMode;
  if (attr("gcm") !== null || gcmCfg) {
    const MAP: Record<string, string> = {
      ad_storage: "marketing",
      ad_user_data: "marketing",
      ad_personalization: "marketing",
      analytics_storage: "analytics",
      functionality_storage: "functionality",
      personalization_storage: "functionality",
    };
    const state: Record<string, unknown> = { wait_for_update: 500, security_storage: "granted" };
    for (const key in MAP) state[key] = accepted.indexOf(MAP[key]!) > -1 ? "granted" : "denied";
    const dl = (w.dataLayer = (w.dataLayer as unknown[]) || []);
    // eslint-disable-next-line prefer-rest-params
    function gtag(..._a: unknown[]) {
      dl.push(arguments);
    }
    gtag("consent", "default", state);
  }

  // -- activate gated elements for valid consent --------------------------
  const ok = (cat: string, svc: string | null): boolean => {
    if (accepted.indexOf(cat) < 0) return false;
    if (!svc) return true;
    const list = stored!.s && stored!.s[cat];
    return !list || list.indexOf(svc) > -1;
  };
  const activate = (): void => {
    const nodes = d.querySelectorAll("[data-consent]:not([data-consent-activated])");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      const cat = el.getAttribute("data-consent");
      if (!cat || !ok(cat, el.getAttribute("data-consent-service"))) continue;
      const src = el.getAttribute("data-consent-src");
      if (el.tagName === "SCRIPT") {
        const s = d.createElement("script");
        const at = el.attributes;
        for (let j = 0; j < at.length; j++) {
          const a = at[j]!;
          if (a.name !== "type" && a.name.indexOf("data-consent") !== 0) s.setAttribute(a.name, a.value);
        }
        if (src) s.src = src;
        else s.text = el.textContent || "";
        s.setAttribute("data-consent-activated", "");
        el.parentNode?.replaceChild(s, el);
      } else {
        if (src) el.setAttribute("src", src);
        el.setAttribute("data-consent-activated", "");
      }
    }
  };
  if (fresh) {
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", activate);
    else activate();
  }

  // -- full widget loading ------------------------------------------------
  let loading: Promise<void> | null = null;
  const loadFull = (): Promise<void> =>
    (loading ||= new Promise((resolve, reject) => {
      const s = d.createElement("script");
      s.src = fullSrc;
      s.async = true;
      s.setAttribute("data-auto", "");
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("consentloop: failed to load " + fullSrc));
      d.head.appendChild(s);
    }));

  // Proxy API: calling anything loads the real widget, then replays the call.
  const proxy: Record<string, unknown> = { loaded: false, version: "loader" };
  const METHODS = [
    "run",
    "show",
    "hide",
    "showPreferences",
    "hidePreferences",
    "acceptAll",
    "rejectAll",
    "accept",
    "reset",
    "rescan",
    "setLanguage",
    "on",
  ];
  METHODS.forEach((fn) => {
    proxy[fn] = (...args: unknown[]) =>
      loadFull().then(() => {
        const real = w.ConsentLoop as Record<string, (...a: unknown[]) => unknown>;
        return real && real[fn] && real[fn]!(...args);
      });
  });
  // Sync getters answered straight from the stored record.
  proxy.isAccepted = (cat: string) => ok(cat, null);
  proxy.isServiceAccepted = (cat: string, svc: string) => ok(cat, svc);
  proxy.acceptedCategories = () => accepted.slice();
  proxy.hasConsent = () => !!fresh;
  proxy.getConsent = () => (fresh ? stored : null);
  if (!w.ConsentLoop) w.ConsentLoop = proxy;

  // Load the full widget only when actually needed: no valid consent (banner must
  // render), or the page config carries features the loader can't serve (hooks,
  // adapters, custom Consent Mode maps). A plain declarative config with valid
  // consent costs zero extra bytes.
  const needsEngine =
    !fresh ||
    !!(cfg && (cfg.hooks || cfg.adapter || cfg.manage || (typeof gcmCfg === "object" && gcmCfg && (gcmCfg as Record<string, unknown>).map)));
  if (needsEngine) {
    const idle =
      (w.requestIdleCallback as ((cb: () => void, o?: object) => void) | undefined) ||
      ((cb: () => void) => setTimeout(cb, 40));
    const kick = (): void => idle(() => void loadFull().catch(console.error));
    if (d.readyState === "complete") kick();
    else window.addEventListener("load", kick);
  }
})();

export {};
