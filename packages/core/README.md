# ConsentLoop

**The fastest cookie consent banner for the web** — a source-available consent management platform (CMP) with **zero dependencies, zero layout shift, and a ~1.5 KB critical-path loader.** GDPR & CCPA ready, Google Consent Mode v2 built in, script & embed gating, per-service consent, 58 languages and a headless mode.

[![npm](https://img.shields.io/npm/v/consentloop?color=4f46e5&label=npm)](https://www.npmjs.com/package/consentloop)
![loader size](https://img.shields.io/badge/loader-1.5%20KB%20gzip-4f46e5)
![dependencies](https://img.shields.io/badge/dependencies-0-4f46e5)
![layout shift](https://img.shields.io/badge/CLS-0.000-4f46e5)
![license](https://img.shields.io/badge/license-FSL--1.1--MIT-4f46e5)

**🌐 Website & docs: [consentloop.io](https://consentloop.io) · 🎨 [Live playground](https://consentloop.io/playground)**

![ConsentLoop cookie consent banner shown on a website](https://raw.githubusercontent.com/kocsmy/ConsentLoop/master/media/hero.png)

A consent banner exists to *stop* scripts from hurting your users — it shouldn't be the thing that hurts them. ConsentLoop is engineered around Core Web Vitals: it defers to idle, renders into an isolated Shadow DOM at `position: fixed` (so **CLS stays 0.000 by construction**), and on the happy path — a returning visitor with valid consent — it downloads nothing but a ~1.5 KB loader and makes zero third-party requests.

## Install

```bash
npm i consentloop
```

Or drop in the CDN smart loader — returning visitors never download the UI:

```html
<script defer src="https://cdn.jsdelivr.net/npm/consentloop/dist/consentloop.loader.min.js" data-gcm></script>
```

## Quick start

```js
import * as ConsentLoop from "consentloop";

ConsentLoop.run({
  categories: {
    necessary: { required: true },
    analytics: { autoClear: [/^_ga/] },
    marketing: {},
  },
  googleConsentMode: true,
  content: { privacyPolicyUrl: "/privacy" },
});
```

That's the whole integration. One entry point, no classes to instantiate.

## Gate scripts & embeds declaratively

Rewrite any tracking tag so it only runs once its category is granted — no code changes to your app logic:

```html
<!-- Analytics: loads only after "analytics" is accepted -->
<script type="text/plain" data-consent="analytics" async
        data-consent-src="https://plausible.io/js/script.js"></script>

<!-- Embeds: the iframe src is withheld until "marketing" is accepted -->
<iframe data-consent="marketing"
        data-consent-src="https://www.youtube.com/embed/xyz"></iframe>
```

## Granular, per-category consent

A clean first-layer banner, and a full preferences dialog for per-category (and per-service) control — accessible, keyboard-navigable, and mapped to Google Consent Mode v2 out of the box.

![ConsentLoop privacy preferences dialog with per-category toggles](https://raw.githubusercontent.com/kocsmy/ConsentLoop/master/media/preferences.png)

## Make it yours — no design handcuffs

Three layouts (box, cloud, bar), light/dark/auto themes, and full design-token control over color, radius, spacing, border and shadow. Configure it visually in the **[playground](https://consentloop.io/playground)** and copy the config out.

![ConsentLoop visual playground for designing the consent banner](https://raw.githubusercontent.com/kocsmy/ConsentLoop/master/media/playground.png)

## Features

- **⚡ Performance-first** — ~1.5 KB gzip critical-path loader; the full widget (~12 KB gzip) loads lazily after first paint. CLS 0.000, ~0 ms TBT for returning visitors.
- **🟢 Google Consent Mode v2** — set `googleConsentMode: true` and defaults/updates are pushed to `gtag` automatically, with a sensible category→signal mapping.
- **🍪 Script & embed gating** — `data-consent` attributes activate scripts, iframes and images when consent is granted; `autoClear` removes cookies on withdrawal.
- **⚖️ GDPR & CCPA** — opt-in by default with an equal-weight Reject-all button; `regulation: "us-optout"` flips to an opt-out model with defaults on.
- **🌍 58 languages** — ready-made locale packs, auto-detection, lazy per-language loading and RTL support.
- **🧩 Headless mode** — `ui: false` to bring your own UI while ConsentLoop handles storage, gating and Consent Mode.
- **♿ Accessible** — focus trap, screen-reader labels, `prefers-reduced-motion`, no dark patterns.
- **📦 Zero dependencies** — nothing in your dependency tree; tree-shakeable ESM with a code-split UI chunk.
- **🔒 Self-hostable & source-available** — no vendor lock-in, no mandatory backend, no telemetry.

## React

First-class React bindings live in **[`@consentloop/react`](https://www.npmjs.com/package/@consentloop/react)** — a `ConsentProvider`, a live `useConsent()` hook, and a `<ConsentGate>` component to render children only when a category is accepted.

```bash
npm i consentloop @consentloop/react
```

## API

`run`, `show`, `hide`, `showPreferences`, `hidePreferences`, `acceptAll`, `rejectAll`, `accept(categories, services?)`, `isAccepted`, `isServiceAccepted`, `acceptedCategories`, `getConsent`, `hasConsent`, `setLanguage`, `rescan`, `reset`, `on`, `destroy`, `version`.

Full JSDoc types in `dist/index.d.ts`; config JSON schema in `consentloop/schema.json` (validate against [`consentloop.schema.json`](https://consentloop.io/consentloop.schema.json)).

## Links

- 🌐 **Website:** https://consentloop.io
- 📚 **Docs:** https://consentloop.io/docs
- 🎨 **Playground:** https://consentloop.io/playground
- 📊 **Performance methodology:** https://consentloop.io/docs/performance
- 🤖 **For AI agents:** https://consentloop.io/llms.txt
- 💻 **Source:** https://github.com/kocsmy/ConsentLoop

## License

Licensed under **FSL-1.1-MIT** (Functional Source License — fair source): free to use, modify and self-host on any site, personal or commercial. Building a competing consent product or managed consent service with it is not permitted. Each release automatically converts to MIT two years after publication. See [LICENSE](https://github.com/kocsmy/ConsentLoop/blob/master/LICENSE).
