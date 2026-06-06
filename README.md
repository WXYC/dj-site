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
Production is on Cloudflare Pages (`wxyc-dj` project). The CF Pages project is configured to deploy from the `prod` branch; merges to `main` build a preview deploy first and are then promoted to `prod` by the staging-gate workflow (see below).

## Staging gate (dj-site)
The staging gate inserts a CF Pages preview-deploy + runtime-probe step between merge-to-`main` and the Cloudflare Pages production deploy. Lives at `.github/workflows/staging-gate.yml`, with helpers in `scripts/staging-gate/` and bats tests in `scripts/__tests__/staging-gate/`. Part of [WXYC/wiki#80](https://github.com/WXYC/wiki/issues/80); mirrors the BS+LML coordinator workflow at [WXYC/wxyc-shared/.github/workflows/bs-lml-gate.yml](https://github.com/WXYC/wxyc-shared/blob/main/.github/workflows/bs-lml-gate.yml).

Flow per merge to `main`:

```
PR merged to main
  -> CF Pages preview build for the main branch (existing, unchanged)
  -> staging-gate polls Cloudflare API for the preview deploy
  -> probes the preview URL for runtime health
  -> on pass, fast-forwards the `prod` branch to <main-sha>
  -> existing CF Pages prod deploy (configured to watch `prod`) fires
```

### Operator setup (one-shot)
The workflow + scripts + tests ship in this repo, but the gate cannot promote until an operator completes these six steps. Failure to complete them is detected at runtime (missing repo vars / secrets cause the gate to surface a clear failure rather than silently bypass).

1. **Seed the `prod` branch** at the current `main` HEAD: `gh api -X POST repos/WXYC/dj-site/git/refs -f ref=refs/heads/prod -f sha=<main-sha>` (or `git push origin <main-sha>:prod` from a clean local clone).
2. **Flip CF Pages production branch** from `main` to `prod`. Path: Cloudflare dashboard → Workers & Pages → `wxyc-dj` → Settings → Builds & deployments → Production branch → change from `main` to `prod`. Leave the preview branch list set to include `main` (or `*` if it already is) so the gate has a preview to wait on.
3. **Create the bypass tracker issue.** Open a long-lived "Gate bypasses" issue in this repo, label it appropriately, and pin it. Note the issue number.
4. **Set repo variables.**
   - `CLOUDFLARE_ACCOUNT_ID` — already set for the existing `cloudflare-deploy-status.yml` monitor; verify.
   - `GATE_BYPASS_ISSUE_NUMBER` — integer from step 3.
5. **Set repo secrets.**
   - `CLOUDFLARE_API_TOKEN` — already set for the existing monitor; verify (needs `Account: Cloudflare Pages: Read` minimum).
   - `PROD_PUSH_PAT` — new. Fine-grained PAT with `Contents: write` permission scoped to `refs/heads/prod` of `WXYC/dj-site` only (a per-ref PAT minimizes blast radius if it leaks).
6. **Branch-protect `prod`.** Repository settings → Branches → add ruleset for `prod`: linear history, restrict push access to the `PROD_PUSH_PAT` identity (or whatever bot account holds the PAT). Operator pushes for rollback are still allowed because they use the same PAT (or a manual `gh api PATCH` from an authorized account).

The in-flight bypass and rollback procedures live in [WXYC/wiki#81](https://github.com/WXYC/wiki/issues/81) (Phase 6 runbook).

### Bypass
Manual `workflow_dispatch` with `skip_gate=true` and a non-empty `justification` skips the CF wait + URL probe but still posts an audit comment to the tracker issue before advancing `prod`. If the audit POST fails, the workflow exits before pushing `prod` (no silent bypasses). The bypass path is intended for cases where the gate itself is broken (e.g., CF API outage) and an out-of-band verified SHA needs to ship.

### Rollback
Roll `prod` back to a prior SHA via the GitHub refs API; CF Pages picks up the change and rebuilds the prior version in ~2 min.

```
gh api -X PATCH repos/WXYC/dj-site/git/refs/heads/prod -f sha=<prior-sha> -F force=true
```

The `force=true` flag is required because the rollback target is an ancestor of the current `prod` HEAD; the API otherwise refuses non-fast-forward updates.

### Tests
Run `npm run test:staging-gate` to execute the bats suite for the helper scripts. The workflow YAML is `actionlint`-clean against the config in `.github/actionlint.yaml` (which declares the custom `e2e-runner` self-hosted runner label so `runs-on: [self-hosted, e2e-runner]` doesn't trip the linter); run `actionlint .github/workflows/staging-gate.yml` locally before pushing changes to the workflow. Not currently wired into CI.

## API Integration
The revised catalog leverages services defined in `api-service.js`, which utilizes the popular Axios library to communicate with an AWS API Gateway. This integration allows seamless communication between the front-end application and the API endpoints, enabling data retrieval and manipulation.

## Technologies Used
- React: The front-end framework used for building the revised WXYC Card Catalog.
- MUI Joy UI: A library of pre-built UI components for React that allows fast and beautiful feature development.
- Github Pages: For hosting the frontend and automating publication.
- Axios: A JavaScript library used for making HTTP requests to the AWS API Gateway.

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

# Default page after login
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet

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

- `lib/__tests__/` - Feature tests (Redux slices, RTK Query APIs)
- `**/*.test.tsx` - Component tests (co-located with components)
- `lib/test-utils/` - Shared test utilities

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
import { server, TEST_BACKEND_URL } from "@/lib/test-utils";

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
import { renderWithProviders } from "@/lib/test-utils";
import MyComponent from "./MyComponent";

describe("MyComponent", () => {
  it("should render", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Test Utilities

Import test utilities from `@/lib/test-utils`:

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
