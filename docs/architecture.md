# Architecture

## Tech Stack

- **Framework**: Next.js 16 (App Router, standalone output for Cloudflare)
- **UI**: React 18, MUI Joy UI (`@mui/joy`), MUI Material (icons), Motion (animations)
- **State**: Redux Toolkit with RTK Query, `react-redux`
- **Auth**: better-auth client + JOSE for JWT, session cookies
- **Testing**: Vitest + jsdom, React Testing Library, MSW 2 for API mocking
- **E2E Testing**: Playwright (Chromium)
- **Build/Deploy**: OpenNext for Cloudflare Pages, Wrangler
- **Language**: TypeScript (strict mode, `@/*` path alias resolves to project root)

## Project Structure

```
app/                          # Next.js App Router pages
  dashboard/                  # Authenticated views
    @classic/                 # Classic theme parallel route
    @modern/                  # Modern theme parallel route (flowsheet, catalog, admin)
    @information/             # Album detail intercepted route
  login/                      # Login page
  onboarding/                 # New user onboarding
  api/                        # API routes
  live/                       # Public live view

src/
  components/
    experiences/classic/      # Classic theme components
    experiences/modern/       # Modern theme components (flowsheet, catalog, admin, login)
    shared/                   # Cross-experience components (branding, layouts, theme)
  hooks/                      # Feature-specific React hooks (flowsheet, catalog, auth, admin, bin, DJ)
  Layout/                     # Layout components
  utilities/                  # Shared utilities
  styles/                     # Global styles

lib/
  features/                   # Redux slices, RTK Query APIs, types, conversions
    admin/                    # Admin / roster management
    application/              # App-level state and API
    authentication/           # Auth state, better-auth client, session utils, org utils
    bin/                      # DJ mail bin
    catalog/                  # Card catalog search
    experiences/              # Theme system (classic/modern registry, preferences)
    flowsheet/                # Flowsheet entries, queue, search, pagination
    rotation/                 # Rotation tracking
  store.ts                    # Redux store (combineSlices, RTK Query middleware)
  hooks.ts                    # Typed Redux hooks (useAppDispatch, useAppSelector, useAppStore)
  createAppSlice.ts           # Slice builder with async thunk support
  __tests__/                  # Feature tests (slices, APIs, conversions)

e2e/                          # Playwright E2E tests
  tests/                      # Test specs
  pages/                      # Page objects
  fixtures/                   # Test data
  scripts/                    # Helper scripts

tests/                        # Additional component/unit tests; vitest helpers/fakes/fixtures/setup
  helpers/                    # Render helpers, harnesses, time utilities (see Testing section)
  fakes/                      # MSW handlers and server
  fixtures/                   # Fixture factories and data
  setup/                      # vitest.setup.ts
```

Each feature in `lib/features/` follows a consistent structure:
- `types.ts` -- TypeScript types/interfaces
- `frontend.ts` -- Redux slice (state + actions + selectors)
- `api.ts` -- RTK Query API definition
- `conversions.ts` -- Pure functions to transform API responses to frontend types
- Additional files as needed (e.g., `client.ts`, `server-utils.ts`)

## Code Conventions

- **Path alias**: `@/` maps to project root (e.g., `@/lib/features/flowsheet/types`)
- **Feature organization**: Each feature has its own directory under `lib/features/` with consistent file naming
- **Typed hooks**: Always use `useAppDispatch`, `useAppSelector`, `useAppStore` from `@/lib/hooks`
- **Experiences**: Two UI themes (modern/classic). Classic theme views prefixed with `CLASSIC_`. The experience system uses a registry pattern (`lib/features/experiences/registry.ts`)
- **No ESLint/Prettier config**: No formatter or linter configuration files exist at the project level. Follow existing code style
- **Strict TypeScript**: `strict: true` in tsconfig
- **Onboarding completeness**: Tracked via the `hasCompletedOnboarding` boolean on the user record, not by presence of profile fields (`realName`/`djName`). This allows admins to pre-fill profile fields when creating accounts without bypassing onboarding. A user is incomplete when `hasCompletedOnboarding !== true` (including when the flag is absent/undefined). The `isUserIncomplete()` function in `server-utils.ts` checks this predicate; `getIncompleteUserAttributes()` still inspects `realName`/`djName` to determine which form fields to render during onboarding.
- **Admin org resolution**: Admin pages (roster, role management) resolve the org slug to its UUID via `resolveOrganizationIdAdmin()` in `lib/features/authentication/organization-utils.ts`. This calls `GET /auth/admin/resolve-organization` on Backend-Service instead of the fragile `getFullOrganization` SDK method. The result is cached for the page session.
