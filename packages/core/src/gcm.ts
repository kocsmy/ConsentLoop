import type { ConsentRecord, ResolvedConfig } from "./types";
import { GCM_KEYS } from "./defaults";

type GcmState = Record<string, "granted" | "denied">;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Google requires the Arguments object, not an array — must be a classic function.
function gtag(..._args: unknown[]): void {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function stateFor(accepted: string[] | null, cfg: ResolvedConfig): GcmState {
  const gcm = cfg.googleConsentMode;
  const state: GcmState = {};
  for (const key of GCM_KEYS) state[key] = key === "security_storage" ? "granted" : "denied";
  if (!gcm) return state;
  if (accepted) {
    for (const cat of accepted) {
      for (const key of gcm.map[cat] || []) state[key] = "granted";
    }
  }
  return state;
}

/** Push Consent Mode defaults. Call as early as possible, before Google tags load. */
export function gcmDefault(cfg: ResolvedConfig, stored: ConsentRecord | null): void {
  if (!cfg.googleConsentMode || typeof window === "undefined") return;
  const state = stateFor(stored ? stored.accepted : null, cfg);
  gtag("consent", "default", { ...state, wait_for_update: cfg.googleConsentMode.waitForUpdate });
}

/** Push a Consent Mode update after a consent change. */
export function gcmUpdate(record: ConsentRecord, cfg: ResolvedConfig): void {
  if (!cfg.googleConsentMode || typeof window === "undefined") return;
  gtag("consent", "update", stateFor(record.accepted, cfg));
}
