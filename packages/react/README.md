# @consentloop/react

React bindings for [ConsentLoop](https://www.npmjs.com/package/consentloop) — the fastest cookie consent on the web. The widget stays vanilla (no React in the render path, no hydration cost); these bindings add a provider, a live hook and a gate component.

```bash
npm i consentloop @consentloop/react
```

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

- `ConsentProvider` — boots the core once, SSR-safe, strict-mode safe.
- `useConsent()` — `{ consent, hasConsent, isAccepted, accept, acceptAll, rejectAll, showPreferences, reset, … }` via `useSyncExternalStore`.
- `ConsentGate` — renders children only when a category (and optional service) is accepted.

All core types re-exported. Docs: https://github.com/kocsmy/ConsentLoop

Licensed under FSL-1.1-MIT (fair source): free to use, modify and self-host on any site — personal or commercial. Building a competing consent product or managed consent service with it is not permitted. Each release automatically converts to MIT two years after publication. See LICENSE in the repository.
