# consentloop

**Cookie consent that costs your site nothing.** Zero dependencies, ~1.4 KB critical-path loader, zero layout shift, zero network calls. Google Consent Mode v2, GDPR/CCPA presets, script & embed gating, per-service consent, i18n, headless mode.

```bash
npm i consentloop
```

```js
import * as ConsentLoop from "consentloop";

ConsentLoop.run({
  categories: {
    necessary: { required: true },
    analytics: { autoClear: [/^_ga/] },
    marketing: {},
  },
  googleConsentMode: true,
});
```

Gate scripts and embeds declaratively:

```html
<script type="text/plain" data-consent="analytics" async
        data-consent-src="https://plausible.io/js/script.js"></script>
<iframe data-consent="marketing" data-consent-src="https://www.youtube.com/embed/xyz"></iframe>
```

Or use the CDN smart loader (~1.4 KB; returning visitors never download the UI):

```html
<script defer src="https://cdn.jsdelivr.net/npm/consentloop/dist/consentloop.loader.min.js" data-gcm></script>
```

## API

`run`, `show`, `hide`, `showPreferences`, `hidePreferences`, `acceptAll`, `rejectAll`, `accept(categories, services?)`, `isAccepted`, `isServiceAccepted`, `acceptedCategories`, `getConsent`, `hasConsent`, `setLanguage`, `rescan`, `reset`, `on`, `destroy`, `version` — full JSDoc in `dist/index.d.ts`, config schema in `consentloop/schema.json`.

React bindings: [`@consentloop/react`](https://www.npmjs.com/package/@consentloop/react).

Docs, interactive configurator, playground and benchmark methodology: https://github.com/kocsmy/ConsentLoop

MIT
