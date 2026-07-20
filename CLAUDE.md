# ConsentLoop — agent guide

Monorepo (pnpm workspaces) for ConsentLoop, an open-source, performance-first cookie consent layer.

## Commands (run from repo root)

- `pnpm install` — install everything (esbuild build script is pre-approved)
- `pnpm build` — build `packages/core` + `packages/react`, then sync bundles into `site/vendor/`
- `pnpm test` — vitest + jsdom suite for the core (52 tests)
- `pnpm size` — gzip budgets: loader ≤ 1.6 KB, full widget ≤ 12.5 KB, ESM entry ≤ 7 KB. **Never merge a red budget.**
- `pnpm bench` — Playwright benchmark (Chromium at `/opt/pw-browsers/chromium`); writes `bench/results/results.json` + `site/bench-results.json`
- `pnpm site` — static server for `site/` on :4173

## Architecture

- `packages/core/src/` — zero-dependency TS core. `index.ts` orchestrates: `store.ts` (config resolve + consent records + cookie/localStorage), `gating.ts` (`data-consent` script/embed activation), `gcm.ts` (Google Consent Mode v2), `i18n.ts`, `adapter.ts` (managed-backend HTTP adapter), `ui/ui.ts` + `ui/styles.ts` (Shadow-DOM widget, lazily imported), `loader.ts` (standalone ~1.4 KB smart loader — duplicates minimal logic on purpose, keep it dependency-free and tiny).
- `packages/react/` — thin bindings (`ConsentProvider`, `useConsent`, `ConsentGate`).
- `site/` — static, no build step. Docs shell injected by `assets/site.js`; interactive config reference driven by `assets/configurator.js`; live preview iframe `assets/preview.html` (postMessage `{type:"run",config}`); `playground/` visual designer. `site/vendor/*` is generated — never edit by hand, run `pnpm build`.
- `schema/consentloop.schema.json` — config schema; keep in sync with `types.ts` when adding options (also copied to `packages/core/schema.json` and `site/` at build).

## Invariants to preserve

1. Loader stays under budget and on the happy path downloads nothing else (returning visitor with valid consent + no hooks config ⇒ zero extra requests).
2. CLS must remain 0: all widget surfaces are `position: fixed`; never add in-flow elements.
3. Core has zero runtime dependencies; UI loads via dynamic import (code-split in ESM build).
4. Stored cookie shape (`{id,t,u,r,a,j,s,g,m,v}`) is a compatibility contract between loader and core — bump carefully.
5. Every new config option needs: `types.ts` JSDoc, schema entry, `llms-full.txt` section, a test, and (if visual) a configurator control.

## Verify changes

`pnpm build && pnpm test && pnpm size`, then `node .tmp/verify-site.mjs`-style Playwright smoke against `site/` if UI changed (screenshots + zero console errors).
