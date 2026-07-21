/**
 * ConsentLoop core — public API.
 *
 * Quick start:
 *   import * as ConsentLoop from "consentloop";
 *   ConsentLoop.run({ categories: { necessary: { required: true }, analytics: {} } });
 *
 * Gate scripts with:
 *   <script type="text/plain" data-consent="analytics" data-consent-src="https://..."></script>
 */
import type {
  ConsentEvent,
  ConsentLoopAPI,
  ConsentLoopConfig,
  ConsentRecord,
  ResolvedConfig,
} from "./types";
import { resolveConfig, readStored, isValid, persist as persistRecord, erase, buildRecord, VERSION } from "./store";
import { activateGated } from "./gating";
import { gcmDefault, gcmUpdate } from "./gcm";
import { resolveI18n, type I18n } from "./i18n";
import { clearCookies } from "./cookies";
import { createHttpAdapter } from "./adapter";
import { createEmitter, isBrowser, onIdle, onReady, withTimeout, type Emitter } from "./util";
import type { UiHandle } from "./ui/ui";

export * from "./types";
export { VERSION as version };
/** Identity helper for typed configs in plain JS files. */
export const defineConfig = (config: ConsentLoopConfig): ConsentLoopConfig => config;

interface Instance {
  cfg: ResolvedConfig;
  /** Valid persisted consent. */
  record: ConsentRecord | null;
  /** In-memory effective consent (opt-out presets / "no banner needed" jurisdictions). */
  implied: ConsentRecord | null;
  i18n: I18n | null;
  ui: UiHandle | null;
  uiPromise: Promise<UiHandle | null> | null;
  firstDone: boolean;
  applied: { accepted: string[]; services: Record<string, string[]> };
  forcedLang?: string;
}

let inst: Instance | null = null;
// Module-level so frameworks can subscribe before (or between) run() calls.
const emitter: Emitter = createEmitter("consentloop");

const KNOWN_KEYS = new Set([
  "categories",
  "ui",
  "content",
  "storage",
  "regulation",
  "googleConsentMode",
  "autoScripts",
  "hooks",
  "adapter",
  "manage",
  "debug",
]);

function effective(): ConsentRecord | null {
  return inst ? inst.record || inst.implied : null;
}

function gateQuery(rec: ConsentRecord | null) {
  return {
    isAccepted(category: string, service?: string): boolean {
      if (!rec) return false;
      if (!rec.accepted.includes(category)) return false;
      if (!service) return true;
      const svcs = rec.services[category];
      return svcs ? svcs.includes(service) : true;
    },
  };
}

/** Activate gated elements + clear cookies + fire service callbacks + Consent Mode update. */
function applyEffects(prev: Instance["applied"], rec: ConsentRecord, sendToAdapter: boolean): void {
  const { cfg } = inst!;

  if (cfg.autoScripts) activateGated(gateQuery(rec));

  for (const [name, cat] of Object.entries(cfg.categories)) {
    const wasOn = prev.accepted.includes(name);
    const isOn = rec.accepted.includes(name);
    if (wasOn && !isOn) {
      const matchers = [...(cat.autoClear || [])];
      for (const svc of Object.values(cat.services || {})) matchers.push(...(svc.cookies || []));
      clearCookies(matchers);
    }
    for (const [sName, svc] of Object.entries(cat.services || {})) {
      const sWas = wasOn && (prev.services[name] || []).includes(sName);
      const sIs = isOn && (rec.services[name] || []).includes(sName);
      if (sIs && !sWas) {
        try {
          svc.onAccept?.();
        } catch (e) {
          console.error("[consentloop] onAccept error", e);
        }
      }
      if (sWas && !sIs) {
        if (svc.cookies) clearCookies(svc.cookies);
        try {
          svc.onReject?.();
        } catch (e) {
          console.error("[consentloop] onReject error", e);
        }
      }
    }
  }

  gcmUpdate(rec, cfg);
  inst!.applied = { accepted: [...rec.accepted], services: { ...rec.services } };

  if (sendToAdapter && cfg.adapter?.persist) {
    try {
      void cfg.adapter.persist(rec, { config: cfg, stored: inst!.record });
    } catch {
      /* adapters must never break the page */
    }
  }
}

/** Persist an explicit or implied-dismiss choice and run all effects + hooks. */
function commit(accepted: string[], services: Record<string, string[]>, method: "explicit" | "implied"): void {
  if (!inst) return;
  const { cfg } = inst;
  const prevApplied = inst.applied;
  const prevRecord = effective();
  const rec = buildRecord(accepted, services, cfg, prevRecord, method);
  persistRecord(rec, cfg);
  inst.record = rec;
  inst.implied = null;

  const changed = Object.keys(cfg.categories).filter(
    (c) => prevApplied.accepted.includes(c) !== rec.accepted.includes(c)
  );

  applyEffects(prevApplied, rec, true);

  inst.ui?.hidePrefs();
  inst.ui?.hideBanner();
  updateFab();

  const first = !inst.firstDone;
  inst.firstDone = true;
  if (first) {
    safeHook(() => cfg.hooks.onFirstConsent?.(rec));
    emitter.emit("first-consent", rec);
  }
  safeHook(() => cfg.hooks.onConsent?.(rec));
  emitter.emit("consent", rec);
  if (!first && changed.length) {
    safeHook(() => cfg.hooks.onChange?.(rec, changed));
    emitter.emit("change", { record: rec, changed });
  }
}

function safeHook(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.error("[consentloop] hook error", e);
  }
}

const UI_HOOKS: Record<string, "onBannerShow" | "onBannerHide" | "onPreferencesShow" | "onPreferencesHide"> = {
  "banner-show": "onBannerShow",
  "banner-hide": "onBannerHide",
  "preferences-show": "onPreferencesShow",
  "preferences-hide": "onPreferencesHide",
};

function updateFab(): void {
  if (!inst?.ui) return;
  const ui = inst.cfg.ui;
  inst.ui.setFabVisible(!!(ui && ui.floatingButton && effective()));
}

function ensureUi(): Promise<UiHandle | null> {
  if (!inst || inst.cfg.ui === false || !isBrowser()) return Promise.resolve(null);
  if (inst.ui) return Promise.resolve(inst.ui);
  if (inst.uiPromise) return inst.uiPromise;
  inst.uiPromise = (async () => {
    const { cfg } = inst!;
    const { createUi } = await import("./ui/ui");
    if (!inst!.i18n) inst!.i18n = await resolveI18n(cfg, inst!.forcedLang);
    await new Promise<void>((resolve) => onReady(() => onIdle(resolve)));
    if (!inst || inst.cfg !== cfg) return null;
    const ui = createUi(
      cfg,
      inst.i18n!,
      effective,
      {
        accept: (cats, svcs) => commit(cats, svcs, "explicit"),
        acceptAll: () => api.acceptAll(),
        rejectAll: () => api.rejectAll(),
        dismiss: () => {
          if (!inst) return;
          if (inst.cfg.regulation === "us-optout" && inst.implied) {
            commit(inst.implied.accepted, inst.implied.services, "implied");
          } else {
            inst.ui?.hideBanner();
          }
        },
      },
      (event) => {
        emitter.emit(event);
        const hook = UI_HOOKS[event];
        if (hook) safeHook(() => cfg.hooks[hook]?.());
      }
    );
    inst.ui = ui;
    return ui;
  })();
  return inst.uiPromise;
}

function warnConfig(user: ConsentLoopConfig, cfg: ResolvedConfig): void {
  if (!cfg.debug || typeof console === "undefined") return;
  for (const key of Object.keys(user)) {
    if (!KNOWN_KEYS.has(key)) console.warn(`[consentloop] Unknown config key "${key}" — see https://github.com/kocsmy/ConsentLoop#configuration`);
  }
  onIdle(() => {
    if (!isBrowser() || !inst) return;
    document.querySelectorAll("[data-consent]").forEach((el) => {
      const cat = el.getAttribute("data-consent");
      if (cat && !cfg.categories[cat]) {
        console.warn(`[consentloop] Element gated on unknown category "${cat}"`, el);
      }
    });
  });
}

/* --------------------------------------------------------------- public API */

async function run(config: ConsentLoopConfig = {}): Promise<ConsentLoopAPI> {
  if (!isBrowser()) return api; // SSR no-op — call run() again on the client
  if (inst) return api;

  const cfg = resolveConfig(config);
  if (!cfg.adapter && config.manage?.endpoint) cfg.adapter = createHttpAdapter(config.manage);

  inst = {
    cfg,
    record: null,
    implied: null,
    i18n: null,
    ui: null,
    uiPromise: null,
    firstDone: false,
    applied: { accepted: [], services: {} },
  };
  warnConfig(config, cfg);

  const stored = readStored(cfg);
  const valid = isValid(stored, cfg);
  gcmDefault(cfg, valid ? stored : null);

  if (valid) {
    // Fast path: consent already known — no UI work at all.
    inst.record = stored;
    inst.firstDone = true;
    applyEffects({ accepted: [], services: {} }, stored, false);
    safeHook(() => cfg.hooks.onConsent?.(stored));
    emitter.emit("consent", stored);
    emitter.emit("ready");
    if (cfg.ui && cfg.ui.floatingButton) void ensureUi().then(updateFab);
    return api;
  }

  // No (valid) consent yet — ask the adapter whether/how to prompt.
  let decision;
  if (cfg.adapter?.init) {
    try {
      decision = await withTimeout(
        Promise.resolve(cfg.adapter.init({ config: cfg, stored })),
        config.manage?.timeout ?? 750
      );
    } catch {
      decision = undefined;
    }
  }
  if (decision?.regulation) cfg.regulation = decision.regulation;
  if (decision?.lang) inst.forcedLang = decision.lang;

  const noBannerNeeded = decision?.show === false;
  // Global Privacy Control: under us-optout the signal IS the visitor's opt-out (CCPA/CPRA),
  // so optional categories stay ungranted and no banner is shown.
  const gpc =
    cfg.regulation === "us-optout" &&
    cfg.respectGPC &&
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  if (noBannerNeeded || cfg.regulation === "us-optout") {
    // Opt-out world: defaults apply immediately, banner (if any) offers opting out.
    const defaults = noBannerNeeded
      ? Object.keys(cfg.categories)
      : Object.keys(cfg.categories).filter((c) => {
          const cat = cfg.categories[c]!;
          return cat.required || (cat.default && !gpc);
        });
    const implied = buildRecord(defaults, {}, cfg, null, "implied");
    inst.implied = implied;
    applyEffects({ accepted: [], services: {} }, implied, false);
    safeHook(() => cfg.hooks.onConsent?.(implied));
    emitter.emit("consent", implied);
  }

  if (!noBannerNeeded && !gpc && cfg.ui !== false) {
    const ui = await ensureUi();
    ui?.showBanner();
  }
  emitter.emit("ready");
  return api;
}

export const api: ConsentLoopAPI = {
  run,
  show() {
    void ensureUi().then((ui) => ui?.showBanner());
  },
  hide() {
    inst?.ui?.hideBanner();
  },
  showPreferences() {
    void ensureUi().then((ui) => ui?.showPrefs());
  },
  hidePreferences() {
    inst?.ui?.hidePrefs();
  },
  acceptAll() {
    if (!inst) return;
    const cats = Object.keys(inst.cfg.categories);
    commit(cats, {}, "explicit");
  },
  rejectAll() {
    if (!inst) return;
    commit([], {}, "explicit");
  },
  accept(categories, services = {}) {
    commit(categories, services, "explicit");
  },
  isAccepted(category) {
    return gateQuery(effective()).isAccepted(category);
  },
  isServiceAccepted(category, service) {
    return gateQuery(effective()).isAccepted(category, service);
  },
  acceptedCategories() {
    return effective()?.accepted.slice() || [];
  },
  getConsent() {
    return effective();
  },
  hasConsent() {
    return !!inst?.record;
  },
  async setLanguage(lang) {
    if (!inst) return;
    inst.forcedLang = lang;
    inst.i18n = await resolveI18n(inst.cfg, lang);
    inst.ui?.setI18n(inst.i18n);
  },
  rescan() {
    if (inst?.cfg.autoScripts) activateGated(gateQuery(effective()));
  },
  reset(reprompt = true) {
    if (!inst) return;
    erase(inst.cfg);
    inst.record = null;
    inst.implied = null;
    inst.firstDone = false;
    inst.applied = { accepted: [], services: {} };
    updateFab();
    if (reprompt) api.show();
  },
  on(event: ConsentEvent, cb) {
    return emitter.on(event, cb);
  },
  destroy() {
    inst?.ui?.destroy();
    emitter.clear();
    inst = null;
  },
  version: VERSION,
};

export const {
  show,
  hide,
  showPreferences,
  hidePreferences,
  acceptAll,
  rejectAll,
  accept,
  isAccepted,
  isServiceAccepted,
  acceptedCategories,
  getConsent,
  hasConsent,
  setLanguage,
  rescan,
  reset,
  on,
  destroy,
} = api;
export { run };
export default api;
