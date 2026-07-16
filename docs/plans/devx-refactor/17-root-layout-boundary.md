# S17 — root-layout-boundary

Status: reviewed, PR pending · Risk: risky (Opus) · PR: —

### Independent review (fresh-context, Opus): no blocking issues

All checks CONFIRMED-SAFE with evidence: emotion cache has no insertionPoint/prepend
assumption and `useServerInsertedHTML` is position-independent; the Suspense wraps
only TelemetryPageView (NOT children — ThemeRegistry still flushes SSR styles);
`data-joy-color-scheme` was never SSR'd in either structure (no InitColorSchemeScript
exists; Joy sets documentElement imperatively — identical timing pre/post); classic's
compound `html[data-experience][data-joy-color-scheme]` selectors (Jackson's flag)
receive both attributes unchanged; hydration parity (no provider renders a DOM
wrapper); route table byte-identical (20 routes); scope clean.

**NEEDS-GATE-CHECK (Jackson, at merge or M4):** load classic dark login — confirm
`.signon-table`/`.title` paint dark without a light flash — and classic dark
flowsheet, compared against main. Pixel timing is the one thing static analysis
cannot prove.
Added 2026-07-15 from charter §8 / `<nextjs_rules>` (REFACTOR_CHARTER.md).

## Task

Restructure the root layout so the document shell is server-rendered and the client
provider stack no longer wraps `<html>`.

## Current problem

Census (§1, boundaries): `app/layout.tsx` nests `<html>` inside
`StoreProvider → TelemetryProvider → ThemeRegistry` (all client), placing the entire
application inside the client provider boundary — the charter's "do not place the
complete application under an optional third-party provider" flag. The pageview
component also drags `useSearchParams` into the root layout graph.

## Desired outcome

`<html>`/`<body>` rendered by the server layout with providers inside `<body>`; the
`useSearchParams` consumer (pageview tracking) isolated behind a `Suspense` boundary
so it cannot force dynamic rendering or suspend the shell; provider order and
semantics otherwise unchanged.

## Preserved behavior

- Theme/experience selection identical, including SSR cookie-driven experience switch
  and the #611 reload-only repaint semantics (Joy CssVars limitation) — this slice
  must not change when or how theme CSS variables are applied.
- Redux store availability everywhere it exists today.
- Pageview capture fires with the same timing and payload.
- Font loading, global CSS, and `<body>` attributes unchanged.
- global-error behavior unchanged.

## Excluded scope

`ThemeRegistry` internals; `StoreProvider` internals; theme preference hooks; any
per-route layout; the experiences registry.

## Acceptance criteria

`<html>`/`<body>` emitted by the server component; no client provider above `<html>`;
`useSearchParams` consumer isolated behind `Suspense`; build emits the same
static/dynamic route classification as before the slice (compare `next build` output
pre/post); hydration warnings absent from dev-mode smoke (Jackson gate).

## Verification

Baseline commands (tsc / full vitest / build with route-table diff) + layout and
theme test suites. Runtime: this slice lands immediately before a visual gate —
Jackson smoke-tests theme switching across all four themes, both experiences, login →
dashboard, and checks the console for hydration warnings.

## Result

Restructured (not a no-change). `<html>`/`<body>` are now emitted by the `RootLayout`
server component, with `StoreProvider → TelemetryProvider → ThemeRegistry` moved
inside `<body>`; the `useSearchParams` pageview consumer is isolated behind a
`Suspense fallback={null}` boundary inside `TelemetryProvider`.

### Investigation — why the providers wrapped `<html>`

The nesting was the common-but-suboptimal App Router pattern, not a technical
requirement. Inspecting the theme internals (read-only, excluded scope):

- `ThemeRegistry` uses emotion `CacheProvider` + `useServerInsertedHTML` (the
  emotion-js#2928 SSR pattern) and Joy `CssVarsProvider`. `useServerInsertedHTML`
  collects `<style>` tags during the server render pass and Next hoists them into
  `<head>` regardless of where the hook sits in the tree — it does not need to wrap
  `<html>`.
- Joy `CssVarsProvider` emits its `:root` vars as injected CSS (into `<head>`) and
  manipulates `document.documentElement`'s color-scheme attribute imperatively at
  runtime; neither renders the `<html>` element.
- The `data-experience` attribute on `<html>` is set directly by the server
  component from `serverSideProps` — no provider attaches it.
- `StoreProvider` (Redux) and `TelemetryProvider` (posthog init + pageview + CSP
  reporter) have no document-shell dependency.

So none of the providers attach anything to `<html>`; the canonical structure
(server shell, providers inside `<body>`) is safe and is what the MUI/emotion
official examples use.

### What changed

- `app/layout.tsx`: server component now renders `<html data-experience>`/`<body>`
  directly; providers nest inside `<body>`. Destructured `experience`/`themeId` from
  `serverSideProps.application` (readability in a touched file; no behavior change).
- `src/components/shared/TelemetryProvider.tsx`: wrapped `<TelemetryPageView />` in
  `<Suspense fallback={null}>`, matching the existing `app/login/layout.tsx`
  convention for `useSearchParams` consumers.

### Route-table diff

`next build` route classification byte-identical pre/post (20 routes; all `ƒ`
dynamic except `○ /icon.ico`). The root layout already opts every route into dynamic
rendering via `cookies()` in `createServerSideProps`, so the `Suspense` boundary
changed nothing in the table — it hardens against any future static route. Diff of
the captured route lists: identical.

### Invariant verification

- Theme/experience selection unchanged: `data-experience` still on `<html>` from the
  same `serverSideProps`; theme vars still injected during SSR via
  `useServerInsertedHTML`; `#611` reload-only repaint semantics untouched (ThemeRegistry
  internals not modified). No change to when/how CSS vars are applied → no
  flash-of-wrong-theme regression.
- Redux store, pageview timing/payload (`safeCapturePageview` on the same
  `[pathname, searchParams]` effect), font/global CSS, `<body>` attributes, and
  `global-error` all unchanged.

### Verification performed

- `npx tsc --noEmit`: clean (pre and post).
- `npm run build`: passes; route table identical (diff empty).
- `npm run test:run`: 269 files / 3,670 tests passed — ledger preserved exactly.
- Focused `ThemedLayout` + `Theme/*` suites: 6 files / 33 tests passed.
- No tests added (structure change has no new unit-testable surface; the hydration
  and visual check is the Jackson M4 gate).

### Deviations

None. Excluded scope (ThemeRegistry / StoreProvider internals, theme preference
hooks, per-route layouts, experiences registry) untouched.
