import { api } from "../src/index";

export function clearAllCookies(): void {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      document.cookie = `${name}=; Max-Age=0`;
    }
  }
}

export function cleanup(): void {
  api.destroy();
  clearAllCookies();
  localStorage.clear();
  document.body.innerHTML = "";
  document.documentElement.lang = "";
}

/** The widget's shadow root (or host when shadow is disabled). */
export function root(): ParentNode {
  const host = document.getElementById("consentloop");
  if (!host) throw new Error("widget host not mounted");
  return host.shadowRoot ?? host;
}

export function q<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = root().querySelector(selector) as T | null;
  if (!el) throw new Error(`not found: ${selector}`);
  return el;
}

export function maybeQ(selector: string): HTMLElement | null {
  return root().querySelector(selector);
}

export function click(selector: string): void {
  q(selector).dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
}

export function bannerVisible(): boolean {
  const layer = maybeQ('[data-l="banner"]');
  return !!layer && layer.classList.contains("cl-on");
}

export function prefsVisible(): boolean {
  const layer = maybeQ('[data-l="prefs"]');
  return !!layer && layer.classList.contains("cl-on");
}

export function storedCookie(name = "cl_consent"): Record<string, unknown> | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? JSON.parse(decodeURIComponent(m[1]!)) : null;
}
