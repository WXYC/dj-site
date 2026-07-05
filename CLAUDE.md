# dj-site

DJ flowsheet and card catalog frontend for WXYC 89.3 FM. React-based revision of the original WXYC flowsheet and card catalog at `dj.wxyc.org`.

## Topic guides

CLAUDE.md is a router for the always-loaded reference card. Topic depth lives in `docs/`:

- **[`docs/architecture.md`](docs/architecture.md)** — Tech stack (Next.js 16 / React 18 / MUI Joy UI / Redux Toolkit / better-auth), project structure (app router + parallel routes, `src/components/experiences/{classic,modern}`, `lib/features/*` feature layout), code conventions (path alias, typed hooks, experience registry, onboarding completeness flag, admin org resolution)
- **[`docs/development.md`](docs/development.md)** — Local-dev prerequisites (Backend-Service running), npm script table (`dev`, `build`, `build:opennext`, `test`, `test:e2e`, …), local test credentials
- **[`docs/env-vars.md`](docs/env-vars.md)** — Full env-var reference (`NEXT_PUBLIC_*`, `AUTH_REWRITE_URL`) + feature-flag catalog (`NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED`)
- **[`docs/testing.md`](docs/testing.md)** — Vitest setup, `lib/test-utils/` factory functions, test constants (`TEST_ENTITY_IDS`, `TEST_SEARCH_STRINGS`), time utilities, the slice / API / component / conversion harnesses, MSW patterns, test organization, conventions
- **[`docs/ci-cd.md`](docs/ci-cd.md)** — `.github/workflows/ci.yml` shape, E2E workflow (Docker Compose Backend-Service + Playwright), E2E-only deps (`pg` for Tier 1 SSE), second dj-site instance for the `AUTH_REWRITE_URL` Tier 2 test, Cloudflare Pages deploy via OpenNext / Wrangler, CI pin maintenance (workflow `permissions:` floors, `@gha/v1` reusable refs, `actionlint`)
- **[`docs/test-fixtures.md`](docs/test-fixtures.md)** — Example WXYC catalog data (Juana Molina, Stereolab, Cat Power, Jessica Pratt, Chuquimamani-Condori, Duke Ellington & John Coltrane) for factory overrides

Read the relevant topic doc before doing work in that area.

## Always-loaded rules

- **TypeScript strict mode.** `@/` alias resolves to project root. Typed Redux hooks (`useAppDispatch` / `useAppSelector` / `useAppStore`) from `@/lib/hooks` — never bare `useDispatch` / `useSelector`.
- **Two experiences.** UI lives under `src/components/experiences/{classic,modern}`. Classic-theme views are prefixed `CLASSIC_`. Experience routing uses the registry pattern in `lib/features/experiences/registry.ts`.
- **No formatter / linter config.** Follow existing code style.
- **Test fixtures use real WXYC catalog data**, not mainstream acts. Defaults: `createTestArtist({ name: "Stereolab", … })`, `createTestAlbum({ title: "DOGA", artist: createTestArtist({ name: "Juana Molina", … }), label: "Sonamos", … })`, `createTestFlowsheetQuery({ artist: "Jessica Pratt", album: "On Your Own Love Again", … })`. Full preference list in `docs/test-fixtures.md`.
- **Always render through `renderWithProviders`** for component tests (never bare RTL `render`); use the slice / API / component / conversion harnesses from `@/lib/test-utils` instead of ad-hoc test scaffolds.
- **Branches.** Push to `main` triggers CI; on success the `deploy-production` job in `ci.yml` builds (`build:opennext`) and Direct-Uploads to the `wxyc-dj` Cloudflare Pages project via `wrangler pages deploy` (`scripts/deploy/deploy-cf-pages.sh`). PRs get a per-commit preview deploy from the `preview` job. No `prod` branch; no Cloudflare GitHub App Git build (removed in #810 — its pinned wrangler 3.x boot-500'd OpenNext ≥ 1.19).

## Related Repos

- **Backend-Service** (`github.com/WXYC/Backend-Service`): API server (port 8080) + auth service (port 8082). Provides all REST endpoints consumed by RTK Query APIs
- **wxyc-shared** (`@wxyc/shared`): Shared DTOs, auth client, validation. Published to GitHub Packages. Used for type definitions and auth integration
- **tubafrenzy**: Legacy Java flowsheet. The current database schema originates from here
