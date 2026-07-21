import type { ConsentRecord, ResolvedConfig } from "../types";
import type { I18n } from "../i18n";
import { CSS } from "./styles";
import { doc } from "../util";
import { Z_INDEX } from "../defaults";

export interface UiActions {
  /** Persist a fine-grained choice (from the preferences Save button). */
  accept(categories: string[], services: Record<string, string[]>): void;
  acceptAll(): void;
  rejectAll(): void;
  /** Banner dismissed without a choice (Escape under non-GDPR presets). */
  dismiss(): void;
}

export interface UiHandle {
  showBanner(): void;
  hideBanner(): void;
  showPrefs(): void;
  hidePrefs(): void;
  setFabVisible(visible: boolean): void;
  setI18n(i18n: I18n): void;
  destroy(): void;
  /** The widget host element (for tests / advanced styling). */
  host: HTMLElement;
  /** Root node queries pierce into the shadow root when enabled. */
  query(selector: string): HTMLElement | null;
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const COOKIE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z"/><circle cx="8.5" cy="10.5" r=".5"/><circle cx="12.5" cy="15.5" r=".5"/><circle cx="15.5" cy="9.5" r=".5"/></svg>';

export function createUi(
  cfg: ResolvedConfig,
  i18nInit: I18n,
  getRecord: () => ConsentRecord | null,
  actions: UiActions,
  emit: (event: string) => void
): UiHandle {
  const ui = cfg.ui as Exclude<ResolvedConfig["ui"], false>;
  let i18n = i18nInit;

  const host = doc!.createElement("div");
  host.id = "consentloop";
  host.style.display = "contents";
  const useShadow = ui.shadow !== false && !!host.attachShadow;
  const rootNode: ShadowRoot | HTMLElement = useShadow ? host.attachShadow({ mode: "open" }) : host;

  // styles: constructable sheet when possible, <style> otherwise
  let styleEl: HTMLStyleElement | null = null;
  let adopted = false;
  if (useShadow && "adoptedStyleSheets" in Document.prototype && typeof CSSStyleSheet !== "undefined") {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      (rootNode as ShadowRoot).adoptedStyleSheets = [sheet];
      adopted = true;
    } catch {
      adopted = false;
    }
  }
  if (!adopted) {
    styleEl = doc!.createElement("style");
    styleEl.textContent = CSS;
    rootNode.appendChild(styleEl);
  }
  if (ui.customCss) {
    // a <style> element sorts before adopted sheets, so mirror the mechanism used for the base CSS
    if (adopted) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(ui.customCss);
      (rootNode as ShadowRoot).adoptedStyleSheets = [...(rootNode as ShadowRoot).adoptedStyleSheets, sheet];
    } else {
      const custom = doc!.createElement("style");
      custom.textContent = ui.customCss;
      rootNode.appendChild(custom);
    }
  }

  const root = doc!.createElement("div");
  root.className = "cl-root";
  rootNode.appendChild(root);

  let bannerOpen = false;
  let prefsOpen = false;
  let fabVisible = false;
  let prefsOpenedFromBanner = false;
  let lastFocus: Element | null = null;
  let bannerMarked = false;

  function applyRootAttrs(): void {
    root.setAttribute("data-layout", ui.layout);
    root.setAttribute("data-position", ui.position);
    root.setAttribute("data-prefs", ui.preferences);
    root.setAttribute("data-theme", ui.theme || "auto");
    if (ui.disableTransitions) root.setAttribute("data-anim", "off");
    if (i18n.t.rtl) root.setAttribute("dir", "rtl");
    else root.removeAttribute("dir");
    let style = `--cl-z:${ui.zIndex ?? Z_INDEX};`;
    for (const [k, v] of Object.entries(ui.tokens || {})) style += `--cl-${k}:${v};`;
    root.setAttribute("style", style);
  }

  function catState(name: string): boolean {
    const cat = cfg.categories[name]!;
    if (cat.required) return true;
    const rec = getRecord();
    if (rec) return rec.accepted.includes(name);
    return cat.default;
  }

  function svcState(catName: string, svcName: string): boolean {
    const rec = getRecord();
    if (!rec) return catState(catName);
    if (!rec.accepted.includes(catName)) return false;
    return (rec.services[catName] || []).includes(svcName);
  }

  function render(): void {
    applyRootAttrs();
    const t = i18n.t;
    const b = t.banner!;
    const p = t.preferences!;

    const legal = [
      cfg.content.privacyPolicyUrl
        ? `<a href="${esc(cfg.content.privacyPolicyUrl)}" target="_blank" rel="noopener">${esc(b.privacyPolicy!)}</a>`
        : "",
      cfg.content.cookiePolicyUrl
        ? `<a href="${esc(cfg.content.cookiePolicyUrl)}" target="_blank" rel="noopener">${esc(b.cookiePolicy!)}</a>`
        : "",
      cfg.content.termsUrl
        ? `<a href="${esc(cfg.content.termsUrl)}" target="_blank" rel="noopener">${esc(b.terms!)}</a>`
        : "",
    ].join("");
    const links =
      legal +
      (b.links || [])
        .map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
        .join("");
    const brand =
      ui.branding !== false
        ? `<a class="cl-brand" href="https://github.com/kocsmy/ConsentLoop" target="_blank" rel="noopener">Powered by <b>ConsentLoop</b></a>`
        : "";
    // box: credit sits on its own line under the buttons; cloud/bar: it rides in the links row
    const inlineBrand = ui.layout === "box" ? "" : brand;

    const bannerButtons = [
      `<button class="cl-btn cl-primary" data-a="accept-all">${esc(b.acceptAll!)}</button>`,
      ui.showRejectAll !== false ? `<button class="cl-btn" data-a="reject-all">${esc(b.rejectAll!)}</button>` : "",
      ui.showPreferences !== false ? `<button class="cl-btn cl-ghost" data-a="open-prefs">${esc(b.preferences!)}</button>` : "",
    ].join("");
    // with no reject button the primary would stretch across the whole row — let it hug its label instead
    const soloActions = ui.showRejectAll === false ? " cl-solo" : "";

    const cats = Object.entries(cfg.categories)
      .map(([name, cat]) => {
        const ct = t.categories?.[name] || {};
        const title = ct.title || name[0]!.toUpperCase() + name.slice(1);
        const services = Object.entries(cat.services || {});
        const control = cat.required
          ? `<span class="cl-always">${esc(p.alwaysOn!)}</span>`
          : `<button class="cl-switch" role="switch" data-cat="${esc(name)}" aria-checked="${catState(name)}" aria-label="${esc(title)}"></button>`;
        const svcRows = services
          .map(
            ([sName, svc]) => `
          <div class="cl-svc">
            <span>${esc(svc.label || sName)}</span>
            <button class="cl-switch" role="switch" data-cat="${esc(name)}" data-svc="${esc(sName)}"
              aria-checked="${svcState(name, sName)}" aria-label="${esc(svc.label || sName)}" ${cat.required ? "disabled" : ""}></button>
          </div>`
          )
          .join("");
        const svcBlock = services.length
          ? `<details class="cl-svcs"><summary>${esc(p.servicesLabel!)} (${services.length})</summary>${svcRows}</details>`
          : "";
        return `
        <section class="cl-cat" data-cat-row="${esc(name)}">
          <div class="cl-cat-head">
            <div>
              <h3 class="cl-cat-title">${esc(title)}</h3>
              <p class="cl-cat-desc">${ct.description || ""}</p>
            </div>
            ${control}
          </div>
          ${svcBlock}
        </section>`;
      })
      .join("");

    root.innerHTML = `
    <div class="cl-layer cl-banner-layer" data-l="banner">
      <div class="cl-banner" role="dialog" aria-modal="false" aria-label="${esc(b.title!)}" tabindex="-1">
        <div class="cl-banner-body">
          <h2 class="cl-title">${esc(b.title!)}</h2>
          <p class="cl-desc">${b.description || ""}</p>
          ${links || inlineBrand ? `<div class="cl-links">${links}${inlineBrand}</div>` : ""}
        </div>
        <div class="cl-actions${soloActions}">${bannerButtons}</div>
        ${inlineBrand ? "" : brand}
      </div>
    </div>
    <div class="cl-layer cl-prefs-layer" data-l="prefs">
      <div class="cl-overlay" data-a="close-prefs"></div>
      <div class="cl-prefs" role="dialog" aria-modal="true" aria-label="${esc(p.title!)}" tabindex="-1">
        <header class="cl-prefs-head">
          <h2 class="cl-title">${esc(p.title!)}</h2>
          <button class="cl-x" data-a="close-prefs" aria-label="${esc(p.close!)}">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>
        ${p.description ? `<p class="cl-desc">${p.description}</p>` : ""}
        <div class="cl-cats">${cats}</div>
        <footer class="cl-prefs-foot">
          <button class="cl-btn" data-a="accept-all">${esc(p.acceptAll!)}</button>
          ${ui.showRejectAll !== false ? `<button class="cl-btn" data-a="reject-all">${esc(p.rejectAll!)}</button>` : ""}
          <button class="cl-btn cl-primary" data-a="save">${esc(p.save!)}</button>
        </footer>
        ${legal || brand ? `<div class="cl-legal">${legal}${brand}</div>` : ""}
      </div>
    </div>
    <div class="cl-layer cl-fab-layer" data-l="fab">
      <button class="cl-fab" data-a="open-prefs" aria-label="${esc(p.title!)}">${COOKIE_ICON}</button>
    </div>`;

    layer("banner").classList.toggle("cl-on", bannerOpen);
    layer("prefs").classList.toggle("cl-on", prefsOpen);
    layer("fab").classList.toggle("cl-on", fabVisible);
  }

  function layer(name: string): HTMLElement {
    return root.querySelector(`[data-l="${name}"]`) as HTMLElement;
  }

  function query(selector: string): HTMLElement | null {
    return root.querySelector(selector);
  }

  function syncSwitches(): void {
    root.querySelectorAll<HTMLElement>(".cl-switch").forEach((sw) => {
      const cat = sw.getAttribute("data-cat")!;
      const svc = sw.getAttribute("data-svc");
      sw.setAttribute("aria-checked", String(svc ? svcState(cat, svc) : catState(cat)));
    });
  }

  /* ---------------------------------------------------------- interactions */

  function onClick(e: Event): void {
    const path = e.composedPath ? (e.composedPath()[0] as HTMLElement) : (e.target as HTMLElement);
    const target = path?.closest ? (path.closest("[data-a],[data-cat]") as HTMLElement | null) : null;
    if (!target) return;

    if (target.classList.contains("cl-switch")) {
      const on = target.getAttribute("aria-checked") !== "true";
      target.setAttribute("aria-checked", String(on));
      const cat = target.getAttribute("data-cat")!;
      const svc = target.getAttribute("data-svc");
      const row = root.querySelector(`[data-cat-row="${cat}"]`)!;
      if (!svc) {
        // category switch drives its services
        row.querySelectorAll<HTMLElement>("[data-svc]").forEach((s) => s.setAttribute("aria-checked", String(on)));
      } else {
        // any service on -> category on; all services off -> category off
        const anyOn = [...row.querySelectorAll("[data-svc]")].some((s) => s.getAttribute("aria-checked") === "true");
        row.querySelector("[data-cat]:not([data-svc])")?.setAttribute("aria-checked", String(anyOn));
      }
      return;
    }

    switch (target.getAttribute("data-a")) {
      case "accept-all":
        actions.acceptAll();
        break;
      case "reject-all":
        actions.rejectAll();
        break;
      case "open-prefs":
        showPrefs();
        break;
      case "close-prefs":
        hidePrefs();
        break;
      case "save": {
        const accepted: string[] = [];
        const services: Record<string, string[]> = {};
        for (const name of Object.keys(cfg.categories)) {
          const sw = root.querySelector(`[data-cat="${name}"]:not([data-svc])`);
          const on = cfg.categories[name]!.required || sw?.getAttribute("aria-checked") === "true";
          if (on) accepted.push(name);
          const svcSwitches = root.querySelectorAll(`[data-svc][data-cat="${name}"]`);
          if (svcSwitches.length) {
            services[name] = [...svcSwitches]
              .filter((s) => s.getAttribute("aria-checked") === "true")
              .map((s) => s.getAttribute("data-svc")!);
          }
        }
        actions.accept(accepted, services);
        break;
      }
    }
  }

  function focusables(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],summary,[tabindex]:not([tabindex='-1'])")];
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (prefsOpen) {
        e.stopPropagation();
        hidePrefs();
      } else if (bannerOpen && cfg.regulation !== "gdpr") {
        actions.dismiss();
      }
      return;
    }
    if (e.key === "Tab" && prefsOpen && ui.trapFocus !== false) {
      const card = query(".cl-prefs")!;
      const items = focusables(card);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = (rootNode as ShadowRoot).activeElement || doc!.activeElement;
      if (e.shiftKey && (active === first || active === card)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ------------------------------------------------------------- controls */

  // Opt-in scroll lock (ui.scrollLock): freeze page scroll while a layer is open.
  let scrollPrev: string | null = null;
  function syncScrollLock(): void {
    if (!ui.scrollLock || !doc) return;
    const el = doc.documentElement;
    if (bannerOpen || prefsOpen) {
      if (scrollPrev === null) {
        scrollPrev = el.style.overflow || "";
        el.style.overflow = "hidden";
      }
    } else if (scrollPrev !== null) {
      el.style.overflow = scrollPrev;
      scrollPrev = null;
    }
  }

  function showBanner(): void {
    if (bannerOpen) return;
    bannerOpen = true;
    layer("banner").classList.add("cl-on");
    if (!bannerMarked && typeof performance !== "undefined" && performance.mark) {
      performance.mark("consentloop:banner-visible");
      bannerMarked = true;
    }
    syncScrollLock();
    (query(".cl-banner") as HTMLElement)?.focus({ preventScroll: true });
    emit("banner-show");
  }

  function hideBanner(): void {
    if (!bannerOpen) return;
    bannerOpen = false;
    layer("banner").classList.remove("cl-on");
    syncScrollLock();
    emit("banner-hide");
  }

  function showPrefs(): void {
    if (prefsOpen) return;
    prefsOpenedFromBanner = bannerOpen;
    if (bannerOpen) hideBanner();
    prefsOpen = true;
    syncSwitches();
    lastFocus = doc!.activeElement;
    layer("prefs").classList.add("cl-on");
    syncScrollLock();
    (query(".cl-prefs") as HTMLElement)?.focus({ preventScroll: true });
    emit("preferences-show");
  }

  function hidePrefs(): void {
    if (!prefsOpen) return;
    prefsOpen = false;
    layer("prefs").classList.remove("cl-on");
    syncScrollLock();
    emit("preferences-hide");
    if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true });
    if (prefsOpenedFromBanner && !getRecord()) showBanner();
  }

  function setFabVisible(visible: boolean): void {
    fabVisible = visible;
    layer("fab").classList.toggle("cl-on", visible);
  }

  function setI18n(next: I18n): void {
    i18n = next;
    render();
  }

  render();
  host.addEventListener("click", onClick);
  host.addEventListener("keydown", onKeydown as EventListener);

  const containerEl =
    typeof ui.container === "string" ? (doc!.querySelector(ui.container) as HTMLElement | null) : ui.container;
  (containerEl || doc!.body || doc!.documentElement).appendChild(host);

  return {
    showBanner,
    hideBanner,
    showPrefs,
    hidePrefs,
    setFabVisible,
    setI18n,
    destroy() {
      bannerOpen = false;
      prefsOpen = false;
      syncScrollLock();
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKeydown as EventListener);
      host.remove();
    },
    host,
    query,
  };
}
