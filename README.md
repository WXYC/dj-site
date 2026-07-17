# WXYC Card Catalog, Revised

[See the site in action here!](https://dj.wxyc.org)


## Description
The WXYC Card Catalog, Revised is a React-based revision of the original WXYC card catalog and flowsheet. This repository showcases an improved version of the existing catalog and flowsheet, while maintaining the classic theme and preserving the original look. Notably, the revised version is optimized for performance, resulting in faster loading times.

## Features
- Retains the classic theme: The revised version of the WXYC Card Catalog doesn't modify the old look in any way. Users will still experience the familiar aesthetics they are accustomed to.
- Classic theme views: All views within the application that utilize the classic theme are prepended with `CLASSIC_`. This helps users distinguish between the classic and updated versions of the application.
- New theme: With updated components and views, a faster and more seamless workflow between the flowsheet and card catalog is possible.
- Mail Bin: a digital mail bin is available on every account, so DJs can add to the flowsheet directly from their bin without having to type during their sets.

## Deployment
Production and PR previews are built in GitHub Actions and pushed to the `wxyc-dj` Cloudflare Pages project via **Direct Upload** (`wrangler pages deploy`, using the repo's wrangler 4.x). This replaced the Cloudflare Pages Git-build integration, whose pinned wrangler 3.x miscompiled `@opennextjs/cloudflare >= 1.19` into a boot-500 ([WXYC/dj-site#810](https://github.com/WXYC/dj-site/issues/810)).

- **Production** — the `deploy-production` job in `.github/workflows/ci.yml` runs on pushes to `main`, gated on the rest of CI passing. It builds with `npm run build:opennext` and deploys via `scripts/deploy/deploy-cf-pages.sh` (`--branch main`) in its own `cancel-in-progress: false` concurrency group so a queued push can't cancel a mid-flight upload.
- **PR previews** — the single `preview` job in `ci.yml` builds and Direct-Uploads a per-PR preview deployment, then probes its URL and blocks merge on a 5xx (the required "Preview URL smoke check"). Fork PRs soft-skip (no repo secrets); same-repo PRs missing config hard-fail (see #740).
- **Build-time env** — `NEXT_PUBLIC_*` values are inlined at build time and live as repo variables (production: `NEXT_PUBLIC_*`; preview: `PREVIEW_NEXT_PUBLIC_*`). `scripts/deploy/check-build-env.sh` hard-fails a deploy if a required build var is empty or points at localhost. See [`docs/env-vars.md`](docs/env-vars.md).
- **Monitoring** — `.github/workflows/cloudflare-deploy-status.yml` polls the CF API hourly and probes `dj.wxyc.org` for runtime health.

Deploy-helper scripts live in `scripts/deploy/`, each with a bats suite in `scripts/__tests__/deploy/`; run `npm run test:scripts`. See [`docs/ci-cd.md`](docs/ci-cd.md) and the cutover procedure in [`docs/deploy-cutover-runbook.md`](docs/deploy-cutover-runbook.md).

## Technologies Used
- Next.js (App Router): React framework for the revised WXYC Card Catalog.
- MUI Joy UI: A library of pre-built UI components for React that allows fast and beautiful feature development.
- Redux Toolkit / RTK Query: Owns server state, talking directly to [Backend-Service](https://github.com/WXYC/Backend-Service) (see [Local Development Prerequisites](#local-development-prerequisites) below).
- Cloudflare Pages (via OpenNext/wrangler): Hosting and deployment — see [Deployment](#deployment) above.

## Local Development Prerequisites

The frontend requires the WXYC Backend-Service to be running locally for full functionality. Without the backend:
- Authentication will not work
- API calls (flowsheet, library, etc.) will fail
- Most features will be unavailable

**Option 1: Manual Setup**
1. Clone and start [Backend-Service](https://github.com/WXYC/Backend-Service) following its Quick Start guide
2. Ensure both backend (:8080) and auth (:8082) services are running
3. Continue with frontend setup below

**Option 2: Automated Setup**
Use the setup script from [wxyc-shared](https://github.com/WXYC/wxyc-shared) to automatically configure the entire stack.

## Installation and Setup
1. Clone the repository: `git clone https://github.com/WXYC/dj-site.git`
2. Navigate to the project directory: `cd dj-site`
3. Install dependencies: `npm install`
4. Create `.env.local` with required environment variables (see below)
5. Run the application: `npm run dev`
6. Access the application locally: Open your web browser and visit `http://localhost:3000`

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Backend API URL (required)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# Better Auth service URL (required for authentication) — browser-facing
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8082/auth

# Optional: server-side override for the /auth/:path* rewrite destination. Set
# this when the auth service is reachable from the host at NEXT_PUBLIC_BETTER_AUTH_URL
# but not from inside the dj-site server process (e.g. docker compose, where
# localhost inside the container is the container itself). Falls back to
# NEXT_PUBLIC_BETTER_AUTH_URL when unset, so production (Cloudflare Pages) needs
# no change.
# AUTH_REWRITE_URL=http://auth:8082/auth

# Default page after login. When unset, all entry points fall back to
# DEFAULT_DASHBOARD_HOME_PAGE in lib/features/application/constants.ts.
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/catalog

# UI Experience settings
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API base URL |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | Auth service URL (must end with `/auth`); used by the browser and as the fallback rewrite target |
| `AUTH_REWRITE_URL` | No | Server-only override for the `/auth/:path*` rewrite destination; defaults to `NEXT_PUBLIC_BETTER_AUTH_URL`. Set in containerized deploys where the browser URL isn't reachable from the dj-site server |
| `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` | No | Redirect path after login |
| `NEXT_PUBLIC_DEFAULT_EXPERIENCE` | No | Default UI theme (`modern` or `classic`) |
| `NEXT_PUBLIC_ENABLED_EXPERIENCES` | No | Comma-separated list of available themes |
| `NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING` | No | Enable theme switching in UI |

## Authentication Flow

The application uses [Better Auth](https://www.better-auth.com/) for authentication, running as a separate service within Backend-Service.

**How it works:**
1. User submits credentials on the login page
2. Frontend sends request to Better Auth service (`NEXT_PUBLIC_BETTER_AUTH_URL`)
3. Better Auth validates credentials against the PostgreSQL database
4. On success, Better Auth returns a JWT token stored in an HTTP-only cookie
5. Subsequent API requests include the token automatically
6. Backend validates tokens via JWKS endpoint

**Test credentials** (local development):
- Username: `test_member`, `test_dj1`, `test_dj2`, `test_music_director`, or `test_station_manager`
- Password: `testpassword123`

## Testing

The project uses [Vitest](https://vitest.dev/) for testing with React Testing Library and MSW for API mocking.

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

All vitest tests live under the top-level `tests/` hierarchy (never co-located
with source):

- `tests/unit/` — feature/hook/utility tests (Redux slices, RTK Query APIs, hooks), mirroring source paths
- `tests/integration/` — component and route-handler tests (rendered with providers + MSW)
- `tests/contract/` — wire-shape contracts (charset, soft-fail)
- `tests/helpers/`, `tests/fakes/`, `tests/fixtures/`, `tests/setup/` — shared harnesses, MSW handlers, fixture factories, vitest setup
- `e2e/` — Playwright suites (own config)

### Linting

```bash
npm run lint
```

ESLint (flat config, `eslint.config.mjs`) runs in CI; errors must stay at zero.
Disabled rules carry inline rationale; warnings are a tracked cleanup backlog.

### Writing Tests

#### Redux Slice Tests

```typescript
import { describe, it, expect } from "vitest";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

describe("flowsheetSlice", () => {
  it("should set autoplay", () => {
    const nextState = flowsheetSlice.reducer(
      initialState,
      flowsheetSlice.actions.setAutoplay(true)
    );
    expect(nextState.autoplay).toBe(true);
  });
});
```

#### RTK Query Tests with MSW

```typescript
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL } from "@/tests/helpers";

describe("catalogApi", () => {
  it("should fetch albums", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        return HttpResponse.json([{ id: 1, title: "Test Album" }]);
      })
    );
    // ... test implementation
  });
});
```

#### Component Tests

```typescript
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import MyComponent from "./MyComponent";

describe("MyComponent", () => {
  it("should render", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Test Utilities

Import test utilities from `@/tests/helpers`:

- `renderWithProviders` - Render with Redux and MUI providers
- `createTestAlbum`, `createTestArtist`, etc. - Factory functions for test data
- `server` - MSW server instance for API mocking
- `TEST_BACKEND_URL` - Backend URL constant for MSW handlers

## Contributing
Contributions to the WXYC Card Catalog, Revised are welcome! If you would like to contribute, please follow these steps:
1. Create a new branch: `git checkout -b my-feature-branch`
2. Make your changes and commit them: `git commit -m "Add some feature"`
3. Test your build: `npm run build`
4. Push to the branch: `git push origin my-feature-branch`
5. Submit a pull request detailing your changes.
6. When your pull request is approved, Github Actions will auto-deploy your changes to the site. Be sure to give 5-10 minutes after the build completes for the changes to propagate.

## License
The WXYC Card Catalog, Revised is released under the [MIT License](LICENSE). Feel free to use, modify, and distribute the code as per the terms of this license.

## Acknowledgments
We would like to express our gratitude to the contributors and maintainers of the original WXYC Card Catalog for their valuable work, which served as the foundation for this revised version. In particular, Tim Ross/Tubafrenzy, who developed the original flowsheet site and maintained the database for years during decades when it was much more difficult to maintain and develop a site like this one.
