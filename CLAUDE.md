# dj-site

React frontend for the WXYC DJ flowsheet and card catalog. Provides the DJ interface for logging playlists, searching the music library, managing the mail bin, and station administration.

**Production URL:** https://dj.wxyc.org

## Architecture

### Tech Stack

- **Next.js 16** (App Router) with React 18
- **Redux Toolkit** + **RTK Query** for state management and API calls
- **MUI Joy UI** for component library
- **better-auth** client for authentication
- **OpenNext** + **Cloudflare Pages** for deployment
- **Vitest** + React Testing Library + MSW for testing

### Project Structure

```
app/                              # Next.js App Router
  dashboard/                      # Main authenticated area
    @modern/                      # Modern UI (route slot)
    @classic/                     # Classic UI (route slot)
    @information/                 # Modal slot (album details, settings)
  login/                          # Auth pages
  api/                            # Route handlers
  auth/                           # better-auth integration
  layout.tsx                      # Root layout with providers

lib/                              # Core business logic
  features/                       # Redux slices + RTK Query APIs
    authentication/               # Auth state, better-auth client
    flowsheet/                    # Show entries, queue, now playing
    catalog/                      # Album/artist search
    bin/                          # DJ mail bin
    rotation/                     # Rotation bins (heavy/medium/light)
    admin/                        # Roster management
    application/                  # App-wide state
    experiences/                  # Theme switching
    backend.ts                    # Centralized backendBaseQuery
    session.ts                    # Server-side session utils
  test-utils/                     # Testing utilities
  hooks.ts                        # Typed Redux hooks
  store.ts                        # Redux store config
  createAppSlice.ts               # Custom createSlice with asyncThunk
  __tests__/features/             # Feature tests

src/components/                   # React components
  experiences/modern/             # New UI components
  experiences/classic/            # Legacy-look components
  shared/                         # Shared components (Theme, layouts)
src/hooks/                        # Feature-specific hooks
src/styles/                       # Global CSS, fonts
```

### Feature Module Pattern

Each feature in `lib/features/` follows a consistent structure:

| File | Purpose |
|------|---------|
| `api.ts` | RTK Query endpoint definitions (queries and mutations) |
| `types.ts` | TypeScript interfaces for the feature |
| `frontend.ts` | Redux slice (state, actions, selectors) |
| `conversions.ts` | Transform API responses (snake_case) to frontend types (camelCase) |

### State Management

Redux store (`lib/store.ts`) uses `combineSlices` (RTK 2.0). Slices and APIs:

- **Slices**: authentication, application, catalog, flowsheet, bin, rotation, admin
- **RTK Query APIs**: catalogApi, flowsheetApi, binApi, rotationApi, applicationApi, experienceApi

Custom middleware `rtkQueryErrorLogger` toasts error messages from rejected RTK Query calls.

Typed hooks in `lib/hooks.ts`: `useAppDispatch`, `useAppSelector`, `useAppStore`.

### API Integration

All API calls go through `backendBaseQuery` (`lib/features/backend.ts`), which:
1. Prepends `NEXT_PUBLIC_BACKEND_URL/{domain}` to all requests
2. Attaches a Bearer token from `getJWTToken()` (fetched from better-auth's `/token` endpoint)

API domains: `/library/`, `/flowsheet/`, `/rotation/`, `/bin/`, `/admin/`, `/experiences/`

### Authentication

**Client-side** (`lib/features/authentication/client.ts`):
- `createAuthClient()` with better-auth plugins (admin, username, jwt, organization)
- `getBaseURL()` detects same-origin proxy for session cookies
- Falls back to `NEXT_PUBLIC_BETTER_AUTH_URL` or `https://api.wxyc.org/auth`

**Server-side** (`lib/features/authentication/server-utils.ts`):
- `requireAuth()` validates session via HTTP-only cookies, redirects to login if unauthenticated

**Redux slice** (`lib/features/authentication/frontend.ts`):
- Stores form validation state only (username, password, djName, etc.)
- Auth session state is managed by better-auth via cookies + `authClient.useSession()` hook

### Experience System (Theme Switching)

The app supports two UI experiences:
- **Modern** -- New UI with updated components
- **Classic** -- Preserves the original WXYC flowsheet look

Switching is handled via Next.js parallel route slots (`@modern`, `@classic`) and a `data-experience` attribute on `<html>`. The CSS class `"ignoreClassic"` excludes elements from classic styling.

### Provider Stack

Root layout (`app/layout.tsx`) wraps the app with:
1. `<StoreProvider>` -- Redux store (created once via `useRef`)
2. `<ThemeRegistry>` -- MUI Joy UI theming with CssVarsProvider
3. `<Toaster>` -- sonner toast notifications
4. `<PageTitleUpdater>` -- Dynamic page titles

## Development

### Running Locally

```bash
npm install
npm run dev              # Next.js dev server (port 3000)
```

Requires Backend-Service (port 8080) and Auth (port 8082) running. Use `wxyc-shared`'s setup script for the full stack:

```bash
cd ../wxyc-shared && ./scripts/setup-dev-environment.sh
```

### Key Dependencies

- `@mui/joy` (5.0.0-beta) -- Component library
- `@atlaskit/pragmatic-drag-and-drop` -- Flowsheet entry reordering
- `motion` -- Animations
- `sonner` -- Toast notifications
- `jose` -- JWT handling
- `webcrypt-session` -- Server-side session handling

## Testing

### Running Tests

```bash
npm test                 # Watch mode
npm run test:run         # Single run
npm run test:ui          # Vitest UI
npm run test:coverage    # With coverage report
```

### Configuration

- **Framework**: Vitest with jsdom environment
- **Config**: `vitest.config.mts`
- **Setup**: `vitest.setup.ts` (MSW server lifecycle, localStorage/matchMedia/ResizeObserver mocks)
- **Coverage**: v8 provider, includes `lib/**/*` and `src/**/*`

### Test Structure

- `lib/__tests__/features/{feature}/` -- Feature tests (slices, APIs, conversions)
- `src/components/**/*.test.tsx` -- Component tests (co-located)
- `lib/test-utils/` -- Shared test utilities

### Test Utilities (`lib/test-utils/`)

| Utility | Purpose |
|---------|---------|
| `renderWithProviders(ui, options)` | Render with Redux + MUI providers |
| `createTestStore()` | Fresh Redux store per test |
| `describeSlice(slice, defaultState, fn)` | Slice test harness |
| `createSliceHarness()` | Direct reducer testing, action chaining |
| Factory functions | `createTestAlbum()`, `createTestFlowsheetEntry()`, `createTestUser()`, etc. |
| `TEST_BACKEND_URL` | Backend URL constant for MSW handlers |
| `TEST_ENTITY_IDS` | Stable IDs for test data |

### MSW Setup (`lib/test-utils/msw/`)

- `server.ts` -- MSW server instance
- `handlers.ts` -- Default mock responses for catalog, flowsheet, rotation, auth APIs

Override handlers per test:
```typescript
server.use(
  http.get(`${TEST_BACKEND_URL}/library/`, () => {
    return HttpResponse.json([{ id: 1, title: "Test Album" }]);
  })
);
```

### Writing Tests

**Redux slice tests:**
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

**Component tests:**
```typescript
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";

describe("MyComponent", () => {
  it("should render", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Backend API base URL |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | same-origin `/auth` or `https://api.wxyc.org/auth` | better-auth endpoint |
| `NEXT_PUBLIC_VERSION` | -- | App version displayed in UI |

## Deployment

- **Platform**: Cloudflare Pages via OpenNext
- **Build**: `npm run build:opennext` produces `.open-next/assets`
- **Deploy**: `npm run deploy` (builds + Wrangler Pages deploy)
- **Preview**: `npm run preview` (local preview of production build)
- **Wrangler config**: `wrangler.jsonc` (project: `wxyc-dj-site`, `nodejs_compat_v2` flag)

GitHub Actions auto-deploys after PR merge.

## Relationship to Other Repos

- **[Backend-Service](https://github.com/WXYC/Backend-Service)** -- API provider. All data comes from here.
- **[@wxyc/shared](https://github.com/WXYC/wxyc-shared)** -- Shared DTOs (used in conversions), auth client, test utilities (factory functions).
- **[tubafrenzy](https://github.com/WXYC/tubafrenzy)** -- Legacy Java flowsheet this app is replacing. Both UIs operate on the same data.
