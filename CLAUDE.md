# dj-site

DJ flowsheet and card catalog frontend for WXYC 89.3 FM. React-based revision of the original WXYC flowsheet and card catalog at `dj.wxyc.org`.

## Topic guides

CLAUDE.md is a router for the always-loaded reference card. Topic depth lives in `docs/`:

- **[`docs/architecture.md`](docs/architecture.md)** — Tech stack (Next.js 16 / React 18 / MUI Joy UI / Redux Toolkit / better-auth), project structure (app router + parallel routes, `src/components/experiences/{classic,modern}`, `lib/features/*` feature layout), code conventions (path alias, typed hooks, experience registry, onboarding completeness flag, admin org resolution)
- **[`docs/development.md`](docs/development.md)** — Local-dev prerequisites (Backend-Service running), npm script table (`dev`, `build`, `build:opennext`, `test`, `test:e2e`, …), local test credentials
- **[`docs/env-vars.md`](docs/env-vars.md)** — Full env-var reference (`NEXT_PUBLIC_*`, `AUTH_REWRITE_URL`) + feature-flag catalog (`NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED`)
- **[`docs/testing.md`](docs/testing.md)** — Vitest setup, `tests/helpers/` factory functions, test constants (`TEST_ENTITY_IDS`, `TEST_SEARCH_STRINGS`), time utilities, the slice / API / component / conversion harnesses, MSW fakes (`tests/fakes/`), test organization, conventions
- **[`docs/ci-cd.md`](docs/ci-cd.md)** — `.github/workflows/ci.yml` shape, E2E workflow (Docker Compose Backend-Service + Playwright), E2E-only deps (`pg` for Tier 1 SSE), second dj-site instance for the `AUTH_REWRITE_URL` Tier 2 test, Cloudflare Pages deploy via OpenNext / Wrangler, CI pin maintenance (workflow `permissions:` floors, `@gha/v1` reusable refs, `actionlint`)
- **[`docs/test-fixtures.md`](docs/test-fixtures.md)** — Example WXYC catalog data (Juana Molina, Stereolab, Cat Power, Jessica Pratt, Chuquimamani-Condori, Duke Ellington & John Coltrane) for factory overrides

Read the relevant topic doc before doing work in that area.

## Always-loaded rules

- **TypeScript strict mode.** `@/` alias resolves to project root. Typed Redux hooks (`useAppDispatch` / `useAppSelector` / `useAppStore`) from `@/lib/hooks` — never bare `useDispatch` / `useSelector`.
- **Two experiences.** UI lives under `src/components/experiences/{classic,modern}`. Classic-theme views are prefixed `CLASSIC_`. Experience routing uses the registry pattern in `lib/features/experiences/registry.ts`.
- **Lint stays at zero errors.** `npm run lint` (ESLint flat config, `eslint.config.mjs`). Warnings are a tracked backlog, not noise to grow — don't add new ones. Every rule disabled in the config carries a one-line rationale; keep that convention when touching it. No formatter config — follow existing code style.
- **Tests are never colocated.** All vitest tests live under `tests/{unit,integration,contract}` mirroring source paths (Playwright stays in `e2e/`, bats in `scripts/__tests__/`). Helpers/factories: `tests/helpers/`; MSW: `tests/fakes/`; fixtures: `tests/fixtures/`; setup: `tests/setup/`.
- **Dashboard home fallback.** The post-auth landing page is `NEXT_PUBLIC_DASHBOARD_HOME_PAGE`; its single-source-of-truth fallback is `DEFAULT_DASHBOARD_HOME_PAGE` in `lib/features/application/constants.ts`. Reference that constant everywhere the env var is read — `next.config.mjs` (can't import TS) and `.env.example` duplicate the literal and MUST match it.
- **Test fixtures use real WXYC catalog data**, not mainstream acts. Defaults: `createTestArtist({ name: "Stereolab", … })`, `createTestAlbum({ title: "DOGA", artist: createTestArtist({ name: "Juana Molina", … }), label: "Sonamos", … })`, `createTestFlowsheetQuery({ artist: "Jessica Pratt", album: "On Your Own Love Again", … })`. Full preference list in `docs/test-fixtures.md`.
- **Always render through `renderWithProviders`** for component tests (never bare RTL `render`); use the slice / API / component / conversion harnesses from `@/tests/helpers` instead of ad-hoc test scaffolds.
- **Branches.** Push to `main` triggers CI; on success the `deploy-production` job in `ci.yml` builds (`build:opennext`) and Direct-Uploads to the `wxyc-dj` Cloudflare Pages project via `wrangler pages deploy` (`scripts/deploy/deploy-cf-pages.sh`). PRs get a per-commit preview deploy from the `preview` job. No `prod` branch; no Cloudflare GitHub App Git build (removed in #810 — its pinned wrangler 3.x boot-500'd OpenNext ≥ 1.19).

## Engineering standards

Established by the 2026-07 DevX refactor (retrospective:
`docs/plans/devx-refactor/RETROSPECTIVE.md`); these outlive it:

- **Backend-Service is the only core external dependency.** Every other external
  service (telemetry, metadata lookup, artwork, flags, …) sits behind an
  application-owned adapter that fails open — provider SDKs and types never leak
  past the adapter (`lib/posthog.ts` is the pattern). Optional-service failure
  must never impair an unrelated workflow.
- **One authoritative owner per value.** RTK Query owns Backend-Service server
  state; Redux only for genuinely shared client-owned state; local state for
  local interaction; URL state when shareability demands it. Don't mirror query
  data, props, or selector results into second copies.
- **Effects only synchronize with systems outside React.** Derive during render;
  handle events in handlers. Every `useEffect` needs a justification, correct
  deps, and cleanup.
- **Comments state non-obvious constraints** — races, invariants, security
  properties, external quirks, issue-numbered rationale. Never narration,
  restatement, section banners, or history (version control has the history).
- **Deletion is a first-class outcome.** Dead code, superseded implementations,
  and unused deps go; "may be useful later" is not a reason. Verify with fresh
  greps before deleting, never trust a stale audit.
- **Abstractions must pay for themselves** — a real domain concept, a necessary
  boundary, a volatile dependency, verified duplication, or impractical-otherwise
  testing. Prefer the strongest pattern already in the repo over imported
  architecture.

## Related Repos

- **Backend-Service** (`github.com/WXYC/Backend-Service`): API server (port 8080) + auth service (port 8082). Provides all REST endpoints consumed by RTK Query APIs
- **wxyc-shared** (`@wxyc/shared`): Shared DTOs, auth client, validation. Published to GitHub Packages. Used for type definitions and auth integration
- **tubafrenzy**: Legacy Java flowsheet. The current database schema originates from here
