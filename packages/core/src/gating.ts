import { doc } from "./util";

/**
 * Script & embed gating.
 *
 * Blocked script:  <script type="text/plain" data-consent="analytics" data-consent-src="https://...">
 *                  (or inline body instead of data-consent-src)
 * Blocked embed:   <iframe data-consent="marketing" data-consent-src="https://www.youtube.com/embed/...">
 *                  (also works on img / video / audio / source)
 *
 * Optional:        data-consent-service="ga4" — only activates when that service is accepted.
 */

const ATTR = "data-consent";
const SRC = "data-consent-src";
const SERVICE = "data-consent-service";
const DONE = "data-consent-activated";

export interface GateQuery {
  isAccepted(category: string, service?: string): boolean;
}

export function activateGated(q: GateQuery): number {
  if (!doc) return 0;
  const D = doc;
  let activated = 0;
  const nodes = D.querySelectorAll<HTMLElement>(`[${ATTR}]:not([${DONE}])`);
  nodes.forEach((el) => {
    const category = el.getAttribute(ATTR);
    if (!category) return;
    const service = el.getAttribute(SERVICE) || undefined;
    if (!q.isAccepted(category, service)) return;

    if (el.tagName === "SCRIPT") {
      const old = el as HTMLScriptElement;
      const s = D.createElement("script");
      for (const a of Array.from(old.attributes)) {
        if (a.name === "type" || a.name === ATTR || a.name === SRC || a.name === SERVICE) continue;
        s.setAttribute(a.name, a.value);
      }
      const src = old.getAttribute(SRC);
      if (src) s.src = src;
      else s.textContent = old.textContent;
      s.setAttribute(DONE, "");
      old.replaceWith(s);
    } else {
      const src = el.getAttribute(SRC);
      if (src) el.setAttribute("src", src);
      el.setAttribute(DONE, "");
    }
    activated++;
  });
  return activated;
}
