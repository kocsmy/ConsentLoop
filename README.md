<div align="center">

# ⟳ ConsentLoop

**Cookie consent that costs your site nothing.**

A ~1.4 KB consent layer for developers, designers and founders — zero dependencies, zero layout shift, zero network calls. Google Consent Mode v2, GDPR & CCPA presets, granular services, i18n, React bindings, headless mode. Continuously benchmarked with a reproducible, cookiebench-style harness (`pnpm bench`).

`npm i consentloop` · Fair source (FSL-1.1-MIT) · [Docs & Playground](site/) · [llms.txt](site/llms.txt)

</div>

---

## Why another cookie banner?

The banner asking permission to load scripts is routinely the heaviest script on the page. Hosted CMPs ship 100–400 KB, fire a dozen requests, and shift your layout. ConsentLoop inverts that:

| | ConsentLoop | vanilla-cookieconsent | c15t | CookieYes | OneTrust |
|---|---|---|---|---|---|
| Critical-path JS (gzip) | **1.49 KB** loader | ~14 KB + CSS | ~0.6 KB + React chunks | ~0.5 KB + ~100 KB | 150–400 KB |
| Extra requests | **0** | 1–2 | 2+ (API) | 4+ | 10+ |
| Layout shift | **0.000** | 0 | 0 | varies | common |
| Consent Mode v2 | **built-in** | manual | built-in | yes | yes |
| Dependencies | **0** | 0 | React | — | — |
| License | **Fair source (FSL)** | MIT | OSS | proprietary | proprietary |

Measured locally, reproducibly: `pnpm bench` (Chromium, 4× CPU throttle, medians of 7 runs) — **ΔFCP ≈ 0 ms (within ±15 ms noise), CLS 0.000, TBT 0 ms for returning visitors, 2.8 KB total wire for the returning-visitor fast path.** Full data: [`bench/results/results.json`](bench/results/results.json), methodology in [site/docs/performance.html](site/docs/performance.html).

## The 30-second install

```html
<!-- 1. The smart loader (~1.4 KB): reads consent, unblocks scripts, pushes
      Consent Mode defaults. Downloads the full widget ONLY if a banner must render. -->
<script defer src="https://cdn.jsdelivr.net/npm/consentloop/dist/consentloop.loader.min.js" data-gcm></script>

<!-- 2. Gate anything on consent -->
<script type="text/plain" data-consent="analytics" async
        data-consent-src="https://plausible.io/js/script.js"></script>
<iframe data-consent="marketing" data-consent-src="https://www.youtube.com/embed/xyz"></iframe>
```

Or from npm:

```js
import * as ConsentLoop from "consentloop";

ConsentLoop.run({
  categories: {
    necessary: { required: true },
    analytics: {
      services: { ga4: { label: "Google Analytics 4" } },
      autoClear: [/^_ga/, "_gid"],          // wiped on withdrawal
    },
    marketing: {},
  },
  googleConsentMode: true,                  // Consent Mode v2 defaults + updates
  ui: { layout: "box", position: "bottom-right", theme: "auto" },
});
```

React:

```jsx
import { ConsentProvider, ConsentGate, useConsent } from "@consentloop/react";

<ConsentProvider config={{ categories: { analytics: {}, marketing: {} } }}>
  <App />
  <ConsentGate category="marketing" fallback={<Placeholder />}>
    <YouTubeEmbed id="xyz" />
  </ConsentGate>
</ConsentProvider>
```

## Feature highlights

- **Smart loader architecture** — returning visitors (most page views) execute ~1.4 KB and never download the UI; `window.ConsentLoop` is a proxy that lazy-loads the widget on demand.
- **Zero layout shift by construction** — every surface is a fixed overlay; animations are transform/opacity only; `prefers-reduced-motion` respected.
- **Script & embed gating** — `data-consent` / `data-consent-src` / `data-consent-service` on scripts, iframes, images; `rescan()` for SPAs; service `onAccept`/`onReject` callbacks for SDK boots.
- **Google Consent Mode v2** — correct `default` before Google tags, `update` after every choice, category→key mapping configurable.
- **Regulation presets** — `gdpr` (opt-in), `us-optout` (CCPA-style implied consent + opt-out), `none`; consent `revision` bumping to re-prompt after policy changes.
- **Granular consent** — categories *and* per-service toggles; auto-clear cookies (string/regex matchers) on withdrawal.
- **i18n** — per-language translations with deep English fallback, `<html lang>`/browser detection, lazy URL-loaded language files, RTL, live `setLanguage()`. **50 ready-made locale packs** ship in the package (`consentloop/locales/*.json`).
- **Minimal, themeable UI** — box/cloud/bar layouts, 7 positions, modal/drawer preferences, light/dark/auto, `--cl-*` design tokens, Shadow-DOM isolation (opt-out-able), full a11y (dialog semantics, focus trap, switches).
- **Headless mode** — `ui: false` keeps the whole engine (storage, gating, GCM, events) under your own UI.
- **Managed-ready** — a two-call adapter contract (`init` → jurisdiction decision, `persist` → consent receipts) powers the upcoming **ConsentLoop Cloud** (geo rules, audit trail, certified CMP) and any self-hosted backend. Offline and networkless by default.

## Built for AI-assisted integration

Agents integrate ConsentLoop in one shot:

- [`site/llms.txt`](site/llms.txt) + [`site/llms-full.txt`](site/llms-full.txt) — the whole product, machine-readable
- [`schema/consentloop.schema.json`](schema/consentloop.schema.json) — validate configs (also shipped as `consentloop/schema.json`)
- Strict, JSDoc'd TypeScript types; one entry point (`run()`); deterministic E2E selectors (`[data-a="accept-all"]` in `#consentloop`)
- Dev-mode `console.warn`s that name the config key to fix

Paste-ready prompt in [site/docs/ai.html](site/docs/ai.html).

## Repository layout

```
packages/core     consentloop        — zero-dep TS core (52 tests, vitest + jsdom)
packages/react    @consentloop/react — provider, useConsent, ConsentGate
site/             landing + interactive docs (configurator) + visual playground
bench/            reproducible Playwright benchmark (pnpm bench)
schema/           JSON Schema for the config
scripts/          build/serve/size-budget tooling
```

## Develop

```bash
pnpm install
pnpm build        # build both packages + sync site vendor bundles
pnpm test         # 52 unit/integration tests
pnpm size         # enforce gzip budgets (loader ≤1.6 KB, widget ≤12.5 KB, ESM entry ≤7 KB)
pnpm bench        # local cookiebench-style measurements
pnpm site         # serve the docs site on :4173
```

## Roadmap

- **ConsentLoop Cloud** — managed geo rules, consent receipts, IAB TCF v2.2 / Google-certified CMP (adapter contract already shipped)
- Per-country regulation packs (LGPD, PIPEDA, UK GDPR nuances) as data, not code
- Vue/Svelte bindings, Nuxt/Next drop-in modules
- CLI: `npx consentloop init` — detect trackers, generate config

**License:** [FSL-1.1-MIT](LICENSE) (Functional Source License, "fair source"). Free to use, modify and self-host on any site — personal or commercial. What it forbids: re-selling ConsentLoop itself as a competing consent product or managed consent service. Each release automatically becomes MIT two years after publication.

© 2026 ConsentLoop contributors
