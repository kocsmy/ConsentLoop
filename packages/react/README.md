# @consentloop/react

**React bindings for [ConsentLoop](https://www.npmjs.com/package/consentloop) — the fastest cookie consent (CMP) for the web.** GDPR & CCPA ready, Google Consent Mode v2, zero layout shift. The widget itself stays vanilla (no React in the render path, no hydration cost); these bindings add a provider, a live hook and a gate component.

[![npm](https://img.shields.io/npm/v/@consentloop/react?color=4f46e5&label=npm)](https://www.npmjs.com/package/@consentloop/react)
![peer](https://img.shields.io/badge/react-%E2%89%A517-4f46e5)
![layout shift](https://img.shields.io/badge/CLS-0.000-4f46e5)
![license](https://img.shields.io/badge/license-FSL--1.1--MIT-4f46e5)

**🌐 Website & docs: [consentloop.io](https://consentloop.io) · 🎨 [Live playground](https://consentloop.io/playground)**

## Install

```bash
npm i consentloop @consentloop/react
```

## Usage

```jsx
import { ConsentProvider, ConsentGate, useConsent } from "@consentloop/react";

export default function App() {
  return (
    <ConsentProvider
      config={{
        categories: { necessary: { required: true }, analytics: {}, marketing: {} },
        googleConsentMode: true,
      }}
    >
      <Site />

      {/* Renders the iframe only once "marketing" is accepted */}
      <ConsentGate category="marketing" fallback={<Placeholder />}>
        <iframe src="https://www.youtube.com/embed/xyz" title="Video" />
      </ConsentGate>
    </ConsentProvider>
  );
}

function CookieSettingsLink() {
  const { showPreferences } = useConsent();
  return <button onClick={showPreferences}>Cookie settings</button>;
}
```

## What you get

- **`ConsentProvider`** — boots the core once. SSR-safe and React Strict-Mode safe.
- **`useConsent()`** — `{ consent, hasConsent, isAccepted, accept, acceptAll, rejectAll, showPreferences, reset, … }`, backed by `useSyncExternalStore` so components re-render the instant consent changes.
- **`<ConsentGate>`** — renders its children only when a category (and optional service) is accepted, with an optional `fallback`.

All core types are re-exported. Works with Next.js (App & Pages Router), Vite, Remix and any React 17+ setup.

## Links

- 🌐 **Website:** https://consentloop.io
- 📚 **React docs:** https://consentloop.io/docs/react.html
- 🎨 **Playground:** https://consentloop.io/playground
- 💻 **Source:** https://github.com/kocsmy/ConsentLoop

## License

Licensed under **FSL-1.1-MIT** (fair source): free to use, modify and self-host on any site, personal or commercial. Building a competing consent product or managed consent service with it is not permitted. Each release automatically converts to MIT two years after publication. See [LICENSE](https://github.com/kocsmy/ConsentLoop/blob/master/LICENSE).
