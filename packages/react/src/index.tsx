/**
 * @consentloop/react — React bindings for ConsentLoop.
 *
 *   <ConsentProvider config={{ categories: { analytics: {} } }}>
 *     <App />
 *   </ConsentProvider>
 *
 *   const { isAccepted, showPreferences } = useConsent();
 *
 *   <ConsentGate category="marketing" fallback={<Placeholder />}>
 *     <YouTubeEmbed id="..." />
 *   </ConsentGate>
 */
import {
  createElement,
  Fragment,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import ConsentLoop, { type ConsentLoopConfig, type ConsentRecord } from "consentloop";

export * from "consentloop";
export { ConsentLoop };

export interface ConsentProviderProps {
  /** Passed to `ConsentLoop.run()` once on mount (idempotent). */
  config?: ConsentLoopConfig;
  children?: ReactNode;
}

/** Boots ConsentLoop on the client. Render once, near the root. SSR-safe. */
export function ConsentProvider({ config, children }: ConsentProviderProps): ReactNode {
  useEffect(() => {
    void ConsentLoop.run(config);
    // ConsentLoop is a singleton — config changes require reset()/destroy() by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createElement(Fragment, null, children);
}

function subscribe(cb: () => void): () => void {
  const offs = [
    ConsentLoop.on("consent", cb),
    ConsentLoop.on("change", cb),
    ConsentLoop.on("ready", cb),
  ];
  return () => offs.forEach((off) => off());
}

const getSnapshot = (): ConsentRecord | null => ConsentLoop.getConsent();
const getServerSnapshot = (): ConsentRecord | null => null;

export interface UseConsentResult {
  /** Current consent record (`null` before any decision). Re-renders on change. */
  consent: ConsentRecord | null;
  /** True once the visitor has an explicit, stored choice. */
  hasConsent: boolean;
  isAccepted(category: string): boolean;
  isServiceAccepted(category: string, service: string): boolean;
  acceptedCategories(): string[];
  accept(categories: string[], services?: Record<string, string[]>): void;
  acceptAll(): void;
  rejectAll(): void;
  show(): void;
  showPreferences(): void;
  reset(reprompt?: boolean): void;
}

/** Live consent state + actions. Safe during SSR (returns `consent: null`). */
export function useConsent(): UseConsentResult {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    consent,
    hasConsent: ConsentLoop.hasConsent(),
    isAccepted: (category) => ConsentLoop.isAccepted(category),
    isServiceAccepted: (category, service) => ConsentLoop.isServiceAccepted(category, service),
    acceptedCategories: () => ConsentLoop.acceptedCategories(),
    accept: (categories, services) => ConsentLoop.accept(categories, services),
    acceptAll: () => ConsentLoop.acceptAll(),
    rejectAll: () => ConsentLoop.rejectAll(),
    show: () => ConsentLoop.show(),
    showPreferences: () => ConsentLoop.showPreferences(),
    reset: (reprompt) => ConsentLoop.reset(reprompt),
  };
}

export interface ConsentGateProps {
  /** Category that must be accepted for children to render. */
  category: string;
  /** Optional service inside the category. */
  service?: string;
  /** Rendered while consent is missing (e.g. a click-to-consent placeholder). */
  fallback?: ReactNode;
  children?: ReactNode;
}

/**
 * Renders children only when the given category (and optional service) is accepted —
 * the React-idiomatic alternative to `data-consent-src` gating for embeds and pixels.
 */
export function ConsentGate({ category, service, fallback = null, children }: ConsentGateProps): ReactNode {
  const { consent } = useConsent();
  const ok = service ? ConsentLoop.isServiceAccepted(category, service) : ConsentLoop.isAccepted(category);
  void consent; // subscription dependency
  return createElement(Fragment, null, ok ? children : fallback);
}
