/* Interactive configuration reference: controls -> live preview + generated code. */
(() => {
  const state = {
    categories: { functionality: false, analytics: true, marketing: true, services: true },
    ui: {
      layout: "box",
      position: "bottom-right",
      preferences: "modal",
      theme: "auto",
      accent: "",
      radius: 16,
      borderW: 1,
      borderColor: "",
      showRejectAll: true,
      showPreferences: true,
      floatingButton: false,
      branding: true,
      scrollLock: false,
      trapFocus: true,
    },
    behavior: { regulation: "gdpr", gcm: true, storage: "cookie", expiresDays: 182, revision: 0 },
    content: { lang: "en", title: "", description: "", privacyPolicyUrl: "", cookiePolicyUrl: "", termsUrl: "" },
  };

  // 50 locale packs ship in the npm package; the preview swaps the CDN URL for this site's copy
  const cdnLocale = (code) => `https://cdn.jsdelivr.net/npm/consentloop/locales/${code}.json`;
  const langSelect = document.getElementById("cfg-lang");
  if (langSelect && window.CL_LOCALES) {
    langSelect.innerHTML = window.CL_LOCALES.map((l) => `<option value="${l.code}">${l.name} · ${l.code}</option>`).join("");
  }

  /* ---------------- config generation ---------------- */
  function buildConfig() {
    const c = { categories: { necessary: { required: true } } };
    if (state.categories.functionality) c.categories.functionality = {};
    if (state.categories.analytics) {
      c.categories.analytics =
        state.categories.services
          ? { services: { ga4: { label: "Google Analytics 4" }, plausible: { label: "Plausible" } } }
          : {};
      if (state.behavior.regulation === "us-optout") c.categories.analytics.default = true;
    }
    if (state.categories.marketing) {
      c.categories.marketing = state.behavior.regulation === "us-optout" ? { default: true } : {};
    }

    const ui = {};
    if (state.ui.layout !== "box") ui.layout = state.ui.layout;
    const defaultPos = state.ui.layout === "box" ? "bottom-right" : "bottom-center";
    if (state.ui.position !== defaultPos) ui.position = state.ui.position;
    if (state.ui.preferences !== "modal") ui.preferences = state.ui.preferences;
    if (state.ui.theme !== "auto") ui.theme = state.ui.theme;
    const tokens = {};
    if (state.ui.accent) {
      tokens.accent = state.ui.accent;
      tokens["switch-on"] = state.ui.accent;
    }
    if (+state.ui.radius !== 16) tokens.radius = state.ui.radius + "px";
    if (+state.ui.borderW !== 1) tokens["border-w"] = state.ui.borderW + "px";
    if (state.ui.borderColor) tokens.border = state.ui.borderColor;
    if (Object.keys(tokens).length) ui.tokens = tokens;
    if (!state.ui.showRejectAll) ui.showRejectAll = false;
    if (!state.ui.showPreferences) ui.showPreferences = false;
    if (state.ui.floatingButton) ui.floatingButton = true;
    if (!state.ui.branding) ui.branding = false;
    if (state.ui.scrollLock) ui.scrollLock = true;
    if (!state.ui.trapFocus) ui.trapFocus = false;
    if (Object.keys(ui).length) c.ui = ui;

    if (state.behavior.regulation !== "gdpr") c.regulation = state.behavior.regulation;
    if (state.behavior.gcm) c.googleConsentMode = true;
    const storage = {};
    if (state.behavior.storage !== "cookie") storage.type = state.behavior.storage;
    if (+state.behavior.expiresDays !== 182) storage.expiresDays = +state.behavior.expiresDays;
    if (+state.behavior.revision !== 0) storage.revision = +state.behavior.revision;
    if (Object.keys(storage).length) c.storage = storage;

    const translations = {};
    if (state.content.lang !== "en") translations[state.content.lang] = cdnLocale(state.content.lang);
    const en = {};
    if (state.content.title) en.banner = { ...(en.banner || {}), title: state.content.title };
    if (state.content.description) en.banner = { ...(en.banner || {}), description: state.content.description };
    if (Object.keys(en).length) translations.en = en;
    const legalUrls = state.content.privacyPolicyUrl || state.content.cookiePolicyUrl || state.content.termsUrl;
    if (Object.keys(translations).length || state.content.lang !== "en" || legalUrls) {
      c.content = {};
      if (state.content.lang !== "en") c.content.lang = state.content.lang;
      if (state.content.privacyPolicyUrl) c.content.privacyPolicyUrl = state.content.privacyPolicyUrl;
      if (state.content.cookiePolicyUrl) c.content.cookiePolicyUrl = state.content.cookiePolicyUrl;
      if (state.content.termsUrl) c.content.termsUrl = state.content.termsUrl;
      if (Object.keys(translations).length) c.content.translations = translations;
    }
    return c;
  }

  /* pretty JS object printer (unquoted safe keys) */
  function toJs(v, indent = 0) {
    const pad = "  ".repeat(indent);
    const padIn = "  ".repeat(indent + 1);
    if (v === null) return "null";
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[" + v.map((x) => toJs(x, indent)).join(", ") + "]";
    }
    if (typeof v === "object") {
      const keys = Object.keys(v);
      if (!keys.length) return "{}";
      const body = keys
        .map((k) => {
          const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
          return `${padIn}${key}: ${toJs(v[k], indent + 1)}`;
        })
        .join(",\n");
      return `{\n${body}\n${pad}}`;
    }
    if (typeof v === "string") return `"${v.replace(/"/g, '\\"')}"`;
    return String(v);
  }

  function codeJs(cfg) {
    return `import * as ConsentLoop from "consentloop";\n\nConsentLoop.run(${toJs(cfg)});`;
  }
  function codeReact(cfg) {
    return `import { ConsentProvider } from "@consentloop/react";\n\nexport default function App() {\n  return (\n    <ConsentProvider config={${toJs(cfg, 2).replace(/\n/g, "\n    ")}}>\n      {/* your app */}\n    </ConsentProvider>\n  );\n}`;
  }
  function codeHtml(cfg) {
    return `<script>window.consentloopConfig = ${toJs(cfg)};<\/script>\n<script defer src="https://cdn.jsdelivr.net/npm/consentloop/dist/consentloop.loader.min.js"><\/script>`;
  }

  /* ---------------- rendering ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const frame = $("#preview-frame");
  let lastMsg = null;

  function pushPreview() {
    const config = buildConfig();
    // preview loads locale packs from this site instead of the CDN
    const tr = config.content && config.content.translations;
    if (tr) for (const k of Object.keys(tr)) if (typeof tr[k] === "string") tr[k] = `/locales/${k}.json`;
    lastMsg = { type: "run", config };
    // Optimistic post; the frame re-requests via cl-frame-loaded if it wasn't ready yet.
    frame.contentWindow?.postMessage(lastMsg, "*");
  }
  addEventListener("message", (e) => {
    if (e.data?.type === "cl-frame-loaded") {
      if (lastMsg) frame.contentWindow.postMessage(lastMsg, "*");
      else pushPreview();
    }
    if (e.data?.type === "cl-consent") {
      const el = $("#last-consent");
      if (el) {
        el.textContent = JSON.stringify(e.data.record, null, 2);
        $("#consent-inspector").hidden = false;
      }
    }
  });

  let regenTimer;
  function update(now) {
    clearTimeout(regenTimer);
    regenTimer = setTimeout(() => {
      const cfg = buildConfig();
      renderCode("code-js", codeJs(cfg), "js");
      renderCode("code-react", codeReact(cfg), "js");
      renderCode("code-html", codeHtml(cfg), "html");
      pushPreview();
    }, now ? 0 : 150);
  }

  function renderCode(id, code, lang) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector("code").innerHTML = clSite.highlight(code, lang);
    el.querySelector(".copy").onclick = (e) => {
      navigator.clipboard.writeText(code).then(() => {
        e.target.textContent = "Copied ✓";
        setTimeout(() => (e.target.textContent = "Copy"), 1200);
      });
    };
  }

  /* ---------------- controls wiring ---------------- */
  function get(path) {
    return path.split(".").reduce((o, k) => o[k], state);
  }
  function set(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((o, k) => o[k], state)[last] = value;
    update();
  }

  document.querySelectorAll("[data-seg]").forEach((seg) => {
    const path = seg.dataset.seg;
    const sync = () =>
      seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === String(get(path))));
    seg.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        set(path, b.dataset.v);
        if (path === "ui.layout") {
          // keep position sensible per layout
          const pos = get("ui.position");
          if (b.dataset.v === "bar" && !/^(top|bottom)-center$/.test(pos)) set("ui.position", "bottom-center");
          if (b.dataset.v === "cloud" && pos === "middle-center") set("ui.position", "bottom-center");
          syncAll();
        }
        sync();
      })
    );
    sync();
    seg._sync = sync;
  });

  document.querySelectorAll("[data-switch]").forEach((sw) => {
    const path = sw.dataset.switch;
    sw.setAttribute("role", "switch");
    sw.className = "uiswitch";
    const sync = () => sw.setAttribute("aria-checked", String(!!get(path)));
    sw.addEventListener("click", () => {
      set(path, !get(path));
      sync();
    });
    sync();
    sw._sync = sync;
  });

  document.querySelectorAll("[data-posgrid]").forEach((grid) => {
    const path = grid.dataset.posgrid;
    const POS = ["top-left", "top-center", "top-right", "middle-center", "bottom-left", "bottom-center", "bottom-right"];
    const CELLS = ["top-left", "top-center", "top-right", "", "middle-center", "", "bottom-left", "bottom-center", "bottom-right"];
    grid.className = "posgrid";
    grid.innerHTML = CELLS.map((p) =>
      p ? `<button data-v="${p}" title="${p}" aria-label="${p}"></button>` : `<span></span>`
    ).join("");
    const sync = () =>
      grid.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === get(path)));
    grid.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        set(path, b.dataset.v);
        sync();
      })
    );
    sync();
    grid._sync = sync;
    void POS;
  });

  document.querySelectorAll("[data-input]").forEach((input) => {
    const path = input.dataset.input;
    const ev = input.type === "color" || input.type === "range" || input.tagName === "SELECT" ? "input" : "input";
    if (input.type === "color") input.value = get(path) || "#4f46e5";
    else input.value = get(path);
    input.addEventListener(ev, () => set(path, input.type === "checkbox" ? input.checked : input.value));
  });
  const accentClear = $("#accent-clear");
  if (accentClear)
    accentClear.addEventListener("click", () => {
      set("ui.accent", "");
      $("#accent-input").value = "#4f46e5";
    });
  const borderColorClear = $("#border-color-clear");
  if (borderColorClear)
    borderColorClear.addEventListener("click", () => {
      set("ui.borderColor", "");
      $("#border-color-input").value = "#e4e4e7";
    });

  function syncAll() {
    document.querySelectorAll("[data-seg],[data-switch],[data-posgrid]").forEach((el) => el._sync && el._sync());
  }

  $("#btn-replay")?.addEventListener("click", () => frame.contentWindow.postMessage({ type: "reset" }, "*"));
  $("#btn-prefs")?.addEventListener("click", () => frame.contentWindow.postMessage({ type: "show-preferences" }, "*"));

  update(true);
})();
