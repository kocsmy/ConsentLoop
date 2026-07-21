/**
 * ConsentLoop — public type contract.
 *
 * Everything an integration (human or AI) needs is in this file.
 * The same shapes are mirrored in `schema/consentloop.schema.json`.
 */

/** Matches cookies for auto-clearing. A string matches an exact name, a RegExp matches the name. */
export type CookieMatcher =
  | string
  | RegExp
  | {
      /** Cookie name (exact string) or pattern. */
      name: string | RegExp;
      /** Cookie domain to clear on (defaults to current host and its parent domains). */
      domain?: string;
      /** Cookie path to clear on (defaults to `/`). */
      path?: string;
    };

/** A single service inside a category (e.g. "Google Analytics" inside "analytics"). */
export interface ServiceConfig {
  /** Human-readable label shown in the preferences UI. Defaults to the service key. */
  label?: string;
  /** Called when this service becomes accepted. */
  onAccept?: () => void;
  /** Called when this service becomes rejected (only after having been accepted). */
  onReject?: () => void;
  /** Cookies to clear when this service is rejected. */
  cookies?: CookieMatcher[];
}

/** A consent category (e.g. necessary, functionality, analytics, marketing). */
export interface CategoryConfig {
  /** Required categories are always granted and cannot be toggled off. */
  required?: boolean;
  /**
   * Whether the category toggle is pre-enabled in the UI before the user chooses.
   * Under `regulation: "gdpr"` this only affects the UI default, never actual consent.
   * Under `regulation: "us-optout"` defaults are treated as granted until the user opts out.
   */
  default?: boolean;
  /** Cookies to clear automatically when this category is rejected or withdrawn. */
  autoClear?: CookieMatcher[];
  /** Optional per-service toggles inside this category. */
  services?: Record<string, ServiceConfig>;
}

/** Where the consent banner appears. */
export type BannerPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Visual arrangement of the first-layer banner. */
export type BannerLayout = "box" | "cloud" | "bar";

/** Visual arrangement of the second-layer preferences surface. */
export type PreferencesLayout = "modal" | "drawer";

export interface UiConfig {
  /** First-layer layout. `box` = compact card, `cloud` = centered pill, `bar` = full-width strip. Default `box`. */
  layout?: BannerLayout;
  /** Banner position. `bar` supports top/bottom rows only. Default `bottom-right` (`bottom-center` for cloud/bar). */
  position?: BannerPosition;
  /** Second-layer layout. Default `modal`. */
  preferences?: PreferencesLayout;
  /** Color scheme. `auto` follows `prefers-color-scheme`. Default `auto`. */
  theme?: "light" | "dark" | "auto";
  /**
   * Design token overrides applied as CSS custom properties on the widget root.
   * Keys are token names without the `--cl-` prefix, e.g. `{ accent: "#6d28d9", radius: "8px" }`.
   */
  tokens?: Record<string, string>;
  /** Show a Reject-all button with equal weight to Accept-all. Default `true`. Keep it on for GDPR. */
  showRejectAll?: boolean;
  /** Show the "Preferences" button on the first layer. Default `true`. */
  showPreferences?: boolean;
  /** Show a small floating button to reopen preferences after consent. Default `false`. */
  floatingButton?: boolean;
  /** Show a subtle "ConsentLoop" credit link. Default `true`. Set `false` to hide. */
  branding?: boolean;
  /** Lock page scrolling while the banner or the preferences dialog is open. Default `false`. */
  scrollLock?: boolean;
  /** Trap keyboard focus inside the preferences dialog while it is open. Default `true` (recommended for WCAG). */
  trapFocus?: boolean;
  /**
   * Extra CSS injected inside the widget root — the supported way to restyle single elements
   * without giving up Shadow-DOM isolation. Target the stable `.cl-*` class names,
   * e.g. `.cl-banner{border:2px solid #000}`. Applied after the built-in styles.
   */
  customCss?: string;
  /** Render inside an isolating Shadow DOM so site CSS can never break the widget. Default `true`. */
  shadow?: boolean;
  /** Element (or selector) to mount into. Defaults to `document.body`. */
  container?: string | HTMLElement;
  /** Disable open/close transitions. Transitions are also disabled by `prefers-reduced-motion`. */
  disableTransitions?: boolean;
  /** z-index of the widget root. Default `2147483000`. */
  zIndex?: number;
}

/** A link rendered in the banner footer (privacy policy, imprint, ...). */
export interface ConsentLink {
  label: string;
  href: string;
}

/** Texts for one language. Any missing key falls back to built-in English. */
export interface Translation {
  /** Right-to-left script. Sets `dir="rtl"` on the widget. */
  rtl?: boolean;
  banner?: {
    title?: string;
    description?: string;
    acceptAll?: string;
    rejectAll?: string;
    preferences?: string;
    /** Label for the `content.privacyPolicyUrl` link. Pre-translated in all built-in locale packs. */
    privacyPolicy?: string;
    /** Label for the `content.termsUrl` link. Pre-translated in all built-in locale packs. */
    terms?: string;
    links?: ConsentLink[];
  };
  preferences?: {
    title?: string;
    description?: string;
    acceptAll?: string;
    rejectAll?: string;
    save?: string;
    close?: string;
    alwaysOn?: string;
    servicesLabel?: string;
  };
  /** Per-category title + description, keyed by category name. */
  categories?: Record<string, { title?: string; description?: string }>;
}

export interface ContentConfig {
  /** Force a language. Otherwise auto-detected. */
  lang?: string;
  /** How to auto-detect the language: from `<html lang>`, from the browser, or not at all. Default `document`. */
  autoDetect?: "document" | "browser" | false;
  /** Fallback language when detection fails. Default `en`. */
  fallback?: string;
  /**
   * Translations per language. A value may also be a URL string —
   * it is fetched lazily (JSON of shape `Translation`) the first time that language is needed.
   */
  translations?: Record<string, Translation | string>;
  /**
   * URL of your privacy policy. Renders a link in the banner and the preferences dialog —
   * the label is already translated in every built-in locale pack.
   */
  privacyPolicyUrl?: string;
  /** URL of your terms & conditions. Renders a link next to the privacy policy link. */
  termsUrl?: string;
}

export interface StorageConfig {
  /** Cookie / storage key. Default `cl_consent`. */
  name?: string;
  /** Persistence mechanism. Default `cookie` (visible to your server). */
  type?: "cookie" | "localStorage";
  /** Days until consent expires and the banner is shown again. Default `182`. */
  expiresDays?: number;
  /** Cookie domain (e.g. `.example.com` to share across subdomains). */
  domain?: string;
  /** Cookie path. Default `/`. */
  path?: string;
  /** Cookie SameSite. Default `Lax`. */
  sameSite?: "Lax" | "Strict" | "None";
  /**
   * Bump this number when your cookie policy changes to re-prompt everyone.
   * Stored consent with a different revision is treated as expired. Default `0`.
   */
  revision?: number;
}

/**
 * Regulation preset:
 * - `gdpr` (default): opt-in. Nothing runs before consent; equal Accept/Reject.
 * - `us-optout`: opt-out. Category defaults are granted immediately; the banner offers opting out.
 * - `none`: like `gdpr` UI but the banner can be dismissed with Escape.
 */
export type Regulation = "gdpr" | "us-optout" | "none";

/** Google Consent Mode v2 integration. */
export interface GoogleConsentModeConfig {
  /**
   * Maps ConsentLoop categories to Consent Mode keys. Defaults:
   * necessary → security_storage; functionality → functionality_storage, personalization_storage;
   * analytics → analytics_storage; marketing → ad_storage, ad_user_data, ad_personalization.
   */
  map?: Record<string, string[]>;
  /** Milliseconds Google tags wait for the consent update. Default `500`. */
  waitForUpdate?: number;
}

/** Decision returned by an adapter (e.g. the ConsentLoop managed backend) before the banner shows. */
export interface RemoteDecision {
  /** `false` = no banner required in this jurisdiction (consent defaults are applied silently). */
  show?: boolean;
  /** Override the regulation preset for this visitor. */
  regulation?: Regulation;
  /** Force a language. */
  lang?: string;
}

/** Context handed to adapter calls. */
export interface AdapterContext {
  config: ResolvedConfig;
  /** The stored consent record, if any. */
  stored: ConsentRecord | null;
}

/**
 * Integration point for a consent backend (jurisdiction lookup, consent receipts, remote config).
 * The built-in HTTP adapter (`manage: { endpoint }`) implements this against the ConsentLoop Cloud API.
 * Everything is optional and must never block rendering — failures fall back to local behavior.
 */
export interface ConsentAdapter {
  /** Called once before the banner is shown. May return a decision (or a promise of one). */
  init?(ctx: AdapterContext): Promise<RemoteDecision | void> | RemoteDecision | void;
  /** Called after every consent change with the full record. Fire-and-forget. */
  persist?(record: ConsentRecord, ctx: AdapterContext): void | Promise<void>;
}

/** Built-in managed-backend connection (ConsentLoop Cloud). */
export interface ManageConfig {
  /** Base URL of the consent API, e.g. `https://api.consentloop.com/v1`. */
  endpoint: string;
  /** Your site/property id. */
  siteId?: string;
  /** Max ms to wait for the jurisdiction decision before showing the banner locally. Default `750`. */
  timeout?: number;
}

/** Lifecycle callbacks. Also available via `ConsentLoop.on(event, cb)` and DOM events (`consentloop:*`). */
export interface Hooks {
  /** First explicit choice by this visitor (fires once per consent id). */
  onFirstConsent?: (record: ConsentRecord) => void;
  /** Consent is known — fires on every page load with valid consent, and after every change. */
  onConsent?: (record: ConsentRecord) => void;
  /** The visitor changed an existing choice. `changed` lists affected categories. */
  onChange?: (record: ConsentRecord, changed: string[]) => void;
  onBannerShow?: () => void;
  onBannerHide?: () => void;
  onPreferencesShow?: () => void;
  onPreferencesHide?: () => void;
}

/** The main configuration passed to `ConsentLoop.run()`. */
export interface ConsentLoopConfig {
  /**
   * Consent categories keyed by name. `necessary: { required: true }` is added automatically
   * unless you define it yourself.
   */
  categories?: Record<string, CategoryConfig>;
  /** UI options — or `false` to run headless (state machine + gating only, bring your own UI). */
  ui?: UiConfig | false;
  /** Texts and languages. */
  content?: ContentConfig;
  /** Persistence options. */
  storage?: StorageConfig;
  /** Regulation preset. Default `gdpr`. */
  regulation?: Regulation;
  /** Enable Google Consent Mode v2 (`true` for defaults) or configure the mapping. */
  googleConsentMode?: boolean | GoogleConsentModeConfig;
  /** Automatically activate `<script type="text/plain" data-consent>` and `[data-consent-src]` elements. Default `true`. */
  autoScripts?: boolean;
  /** Lifecycle callbacks. */
  hooks?: Hooks;
  /** Custom consent backend adapter. */
  adapter?: ConsentAdapter;
  /** Built-in managed backend (ConsentLoop Cloud). Ignored when `adapter` is set. */
  manage?: ManageConfig;
  /** Log helpful integration warnings to the console. Default `true` outside production-looking hosts. */
  debug?: boolean;
}

/** A visitor's consent state. This is what gets stored, sent to adapters and passed to hooks. */
export interface ConsentRecord {
  /** Random id for this consent (rotates when consent is reset). */
  id: string;
  /** ISO timestamp of the first choice. */
  firstAt: string;
  /** ISO timestamp of the last change. */
  updatedAt: string;
  /** Revision the consent was given for. */
  revision: number;
  /** Accepted category names. */
  accepted: string[];
  /** Rejected category names. */
  rejected: string[];
  /** Accepted services per category (a category's key is present only when it has services). */
  services: Record<string, string[]>;
  /** Regulation preset active when consent was given. */
  regulation: Regulation;
  /** How consent came to be: explicit user action, implied by regulation, or imported. */
  method: "explicit" | "implied";
  /** ConsentLoop version that wrote the record. */
  v: string;
}

/** Normalized config after defaults are applied (what adapters and internals see). */
export interface ResolvedConfig extends Required<Pick<ConsentLoopConfig, "regulation" | "autoScripts">> {
  categories: Record<string, Required<Pick<CategoryConfig, "required" | "default">> & CategoryConfig>;
  ui: (UiConfig & { layout: BannerLayout; position: BannerPosition; preferences: PreferencesLayout }) | false;
  content: ContentConfig;
  storage: Required<Pick<StorageConfig, "name" | "type" | "expiresDays" | "path" | "sameSite" | "revision">> & StorageConfig;
  googleConsentMode: (GoogleConsentModeConfig & { map: Record<string, string[]>; waitForUpdate: number }) | false;
  hooks: Hooks;
  adapter?: ConsentAdapter;
  debug: boolean;
}

export type ConsentEvent =
  | "consent"
  | "first-consent"
  | "change"
  | "banner-show"
  | "banner-hide"
  | "preferences-show"
  | "preferences-hide"
  | "ready";

/** The API returned by `run()` and exposed as `window.ConsentLoop` / module exports. */
export interface ConsentLoopAPI {
  /** Initialize (idempotent — returns the existing instance if already running). */
  run(config?: ConsentLoopConfig): Promise<ConsentLoopAPI>;
  /** Show the first-layer banner. */
  show(): void;
  /** Hide the first-layer banner. */
  hide(): void;
  /** Open the preferences surface. */
  showPreferences(): void;
  /** Close the preferences surface. */
  hidePreferences(): void;
  /** Accept everything. */
  acceptAll(): void;
  /** Reject everything optional. */
  rejectAll(): void;
  /**
   * Fine-grained accept. `accept(["analytics"])` grants exactly the given categories
   * (plus required ones); pass `services` to grant a subset of a category's services.
   */
  accept(categories: string[], services?: Record<string, string[]>): void;
  /** Whether a category is currently accepted. */
  isAccepted(category: string): boolean;
  /** Whether a service inside a category is currently accepted. */
  isServiceAccepted(category: string, service: string): boolean;
  /** Currently accepted categories. */
  acceptedCategories(): string[];
  /** The current consent record, or `null` before any choice. */
  getConsent(): ConsentRecord | null;
  /** True when valid (non-expired, current-revision) consent exists. */
  hasConsent(): boolean;
  /** Change UI language at runtime. */
  setLanguage(lang: string): Promise<void>;
  /** Re-scan the DOM for gated scripts/embeds (useful after SPA navigation). */
  rescan(): void;
  /** Erase stored consent. `reprompt` (default `true`) re-shows the banner. */
  reset(reprompt?: boolean): void;
  /** Subscribe to lifecycle events. Returns an unsubscribe function. */
  on(event: ConsentEvent, cb: (detail?: unknown) => void): () => void;
  /** Tear down the widget and all listeners (used by tests/SPAs). */
  destroy(): void;
  /** Library version. */
  readonly version: string;
}
