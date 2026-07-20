/**
 * Browser global build — exposes `window.ConsentLoop` and supports declarative init:
 *
 *   <script defer src="consentloop.iife.min.js" data-auto></script>
 *
 * Config for data-auto comes from `window.consentloopConfig` (set it before this
 * script) or a JSON `data-config` attribute.
 */
import { api } from "./index";

declare global {
  interface Window {
    ConsentLoop: typeof api;
    consentloopConfig?: Parameters<typeof api.run>[0];
  }
}

window.ConsentLoop = api;

const script = document.currentScript;
if (script?.hasAttribute("data-auto")) {
  let config = window.consentloopConfig;
  const inline = script.getAttribute("data-config");
  if (inline) {
    try {
      config = JSON.parse(inline);
    } catch {
      console.error("[consentloop] Invalid JSON in data-config");
    }
  }
  void api.run(config || {});
}
