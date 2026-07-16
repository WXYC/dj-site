# S17 — root-layout-boundary

Status: pending · Risk: risky (Opus) · PR: —
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
