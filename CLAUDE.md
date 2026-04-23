# dj-site

DJ flowsheet and card catalog frontend for WXYC 89.3 FM. React-based revision of the original WXYC flowsheet and card catalog at `dj.wxyc.org`.

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
  test-utils/                 # Test utilities (see Testing section)
  __tests__/                  # Feature tests (slices, APIs, conversions)

e2e/                          # Playwright E2E tests
  tests/                      # Test specs
  pages/                      # Page objects
  fixtures/                   # Test data
  scripts/                    # Helper scripts

tests/                        # Additional component/unit tests
```

Each feature in `lib/features/` follows a consistent structure:
- `types.ts` -- TypeScript types/interfaces
- `frontend.ts` -- Redux slice (state + actions + selectors)
- `api.ts` -- RTK Query API definition
- `conversions.ts` -- Pure functions to transform API responses to frontend types
- Additional files as needed (e.g., `client.ts`, `server-utils.ts`)

## Development

### Prerequisites

The backend must be running locally. See README.md for full setup options.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build (Next.js) |
| `npm run build:opennext` | Build for Cloudflare (OpenNext) |
| `npm run preview` | Build + preview Cloudflare build |
| `npm test` | Run tests in watch mode (Vitest) |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with V8 coverage |
| `npm run test:ui` | Vitest UI |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright UI mode |

### Environment Variables

Create `.env.local`:
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8082/auth
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
```

### Test Credentials (local dev)

Usernames: `test_member`, `test_dj1`, `test_dj2`, `test_music_director`, `test_station_manager`
Password: `testpassword123`

## Testing

### Setup

Vitest config is in `vitest.config.mts`. Global setup in `vitest.setup.ts` handles:
- MSW server lifecycle (`beforeAll`/`afterEach`/`afterAll`)
- `localStorage` mock
- `matchMedia` mock (required by MUI)
- `ResizeObserver` mock (required by MUI)

Globals are enabled (`describe`, `it`, `expect` available without import, though explicit imports from `vitest` are the convention used in this codebase).

### Test Utilities (`lib/test-utils/`)

Import everything from `@/lib/test-utils`:

```typescript
import {
  renderWithProviders,
  createTestAlbum,
  createTestFlowsheetEntry,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
```

#### Rendering

- **`renderWithProviders(ui, options?)`** -- Wraps component in Redux `Provider` + MUI `CssVarsProvider`. Returns `{ ...rtlResult, store, user }`. Accepts `preloadedState` and custom `store`.
- **`createTestStore()`** -- Creates a fresh `AppStore` instance.

#### Factory Functions

All factories accept a `Partial<T>` overrides argument:

| Factory | Returns | Default data source |
|---------|---------|-------------------|
| `createTestArtist(overrides?)` | `ArtistEntry` | `TEST_SEARCH_STRINGS.ARTIST_NAME`, genre "Rock" |
| `createTestAlbum(overrides?)` | `AlbumEntry` | Includes a nested `createTestArtist()`, format "CD" |
| `createTestAlbumQueryResponse(overrides?)` | `AlbumQueryResponse` | Raw API response shape |
| `createTestFlowsheetEntry(overrides?)` | `FlowsheetSongEntry` | Song entry with test strings |
| `createTestFlowsheetQuery(overrides?)` | `FlowsheetQuery` | Search query object |
| `createTestFlowsheetEntryResponse(overrides?)` | `FlowsheetEntryResponse` | Raw API response for conversion tests |
| `createTestUser(overrides?)` | `User` | username "testdj", authority DJ |
| `createTestAuthenticatedUser(overrides?)` | `AuthenticatedUser` | Includes user + tokens |
| `createTestBetterAuthSession(overrides?)` | `BetterAuthSession` | Full session with user/session objects |
| `createTestSessionWithOrgRole(role)` | `BetterAuthSession` | Session with specific org role |
| `createTestBetterAuthJWTPayload(overrides?)` | `BetterAuthJwtPayload` | JWT claims |
| `createTestAccountResult(overrides?)` | `Account` | Admin roster account |
| `createTestBinQueryResponse(overrides?)` | `BinQueryResponse` | Bin entry |
| `createTestOnAirDJResponse(overrides?)` | On-air DJ object | `{ id, dj_name }` |

List factories: `createTestAlbumList(count?)`, `createTestFlowsheetEntryList(count?)`

Message factories: `createTestStartShowMessage(djName?, dateTime?)`, `createTestEndShowMessage(djName?, dateTime?)`, `createTestBreakpointMessage(time?)`

#### Test Constants

```typescript
TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM     // 1001
TEST_ENTITY_IDS.ARTIST.ROCK_ARTIST   // 2001
TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1    // 3001
TEST_ENTITY_IDS.SHOW.CURRENT_SHOW    // 4001
TEST_ENTITY_IDS.ROTATION.HEAVY       // 5001

TEST_SEARCH_STRINGS.ARTIST_NAME      // "Test Artist"
TEST_SEARCH_STRINGS.ALBUM_NAME       // "Test Album"
TEST_SEARCH_STRINGS.TRACK_TITLE      // "Test Track"
TEST_SEARCH_STRINGS.LABEL            // "Test Label"

TEST_BACKEND_URL                      // from env or "http://localhost:3001"
```

#### Time Utilities

```typescript
TEST_TIMESTAMPS.NOW           // 2024-06-15T14:30:00.000Z
TEST_TIMESTAMPS.ONE_HOUR_AGO
TEST_TIMESTAMPS.ONE_DAY_AGO
TEST_TIMESTAMPS.ONE_WEEK_AGO

mockCurrentTime(date?)        // vi.useFakeTimers() + vi.setSystemTime()
restoreRealTime()             // vi.useRealTimers()
toISOString(date)             // date.toISOString()
toDateString(date)            // "YYYY-MM-DD"
offsetFromNow(ms)             // new Date relative to TEST_TIMESTAMPS.NOW
```

#### Test Harnesses

**Slice harness** (`describeSlice`, `createSliceHarness`):
```typescript
describeSlice(flowsheetSlice, defaultFlowsheetFrontendState, ({ harness, actions }) => {
  it("should set autoplay", () => {
    const result = harness().reduce(actions.setAutoplay(true));
    expect(result.autoplay).toBe(true);
  });

  // Chain multiple actions
  const result = harness().chain(actions.setAutoplay(true), actions.setSearchOpen(true));

  // Store-based testing (for selectors)
  const { dispatch, select } = harness().withStore();
  dispatch(actions.setAutoplay(true));
  expect(select(flowsheetSlice.selectors.getAutoplay)).toBe(true);
});
```

**API harness** (`describeApi`, `describeApiEndpoints`, `describeApiStoreIntegration`):
```typescript
describeApi(catalogApi, {
  queries: ["searchCatalog", "getInformation", "getFormats", "getGenres"],
  mutations: ["addAlbum", "addArtist"],
  reducerPath: "catalogApi",
});
```

**Component harness** (`createComponentHarness`, `createComponentHarnessWithQueries`, `testPropVariants`):
```typescript
const setup = createComponentHarnessWithQueries(SearchBar, { color: "primary" }, {
  input: () => screen.getByPlaceholderText("Search"),
});

it("should accept input", async () => {
  const { input, user } = setup();
  await user.type(input(), "test");
  expect(input()).toHaveValue("test");
});
```

**Conversion harness** (`describeConversion`, `describeConversionWithAssertions`, `describeMultiArgConversion`):
```typescript
describeConversion("convertToSong", convertToSong, [
  { name: "should convert basic song", input: mockResponse, expected: expectedResult },
]);
```

#### MSW Setup

Default handlers in `lib/test-utils/msw/handlers.ts` return empty responses for `/library/`, `/authentication/`, `/flowsheet/`, `/rotation/`. Override in individual tests:

```typescript
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL } from "@/lib/test-utils";

server.use(
  http.get(`${TEST_BACKEND_URL}/library/`, () => {
    return HttpResponse.json([createTestAlbumQueryResponse()]);
  })
);
```

### Test Organization

- `lib/__tests__/features/<feature>/` -- Slice tests, API structure tests, conversion tests
- `src/components/**/*.test.tsx` -- Component tests (co-located with the component)
- `tests/` -- Additional component and capability tests

### Test Conventions

- Use `it.each` for parameterized tests
- Use the slice harness for all Redux slice tests
- Use the API harness for verifying RTK Query endpoint structure
- Use `createTest*` factory functions instead of inline test data
- Reference `TEST_ENTITY_IDS` and `TEST_SEARCH_STRINGS` constants for IDs and strings
- Use `renderWithProviders` for all component tests (never bare RTL `render`)

## CI/CD

### CI (`.github/workflows/ci.yml`)

Runs on push/PR to `main`:
1. **Lint & Type Check** -- `npx tsc --noEmit`
2. **Unit Tests** -- `npm run test:run` (uploads coverage artifact)
3. **Build** -- `npm run build`

### E2E (`.github/workflows/e2e-tests.yml`)

Runs on push/PR to `main`. Spins up Backend-Service with Docker Compose (PostgreSQL + auth + backend), builds dj-site, runs Playwright tests.

### Deployment

Cloudflare Pages via OpenNext. Build: `npm run build:opennext`. Deploy: `npm run deploy` (Wrangler).

## Code Conventions

- **Path alias**: `@/` maps to project root (e.g., `@/lib/features/flowsheet/types`)
- **Feature organization**: Each feature has its own directory under `lib/features/` with consistent file naming
- **Typed hooks**: Always use `useAppDispatch`, `useAppSelector`, `useAppStore` from `@/lib/hooks`
- **Experiences**: Two UI themes (modern/classic). Classic theme views prefixed with `CLASSIC_`. The experience system uses a registry pattern (`lib/features/experiences/registry.ts`)
- **No ESLint/Prettier config**: No formatter or linter configuration files exist at the project level. Follow existing code style
- **Strict TypeScript**: `strict: true` in tsconfig
- **Onboarding completeness**: Tracked via the `hasCompletedOnboarding` boolean on the user record, not by presence of profile fields (`realName`/`djName`). This allows admins to pre-fill profile fields when creating accounts without bypassing onboarding. The `isUserIncomplete()` function in `server-utils.ts` checks this flag; `getIncompleteUserAttributes()` still inspects `realName`/`djName` to determine which form fields to render during onboarding.

## Related Repos

- **Backend-Service** (`github.com/WXYC/Backend-Service`): API server (port 8080) + auth service (port 8082). Provides all REST endpoints consumed by RTK Query APIs
- **wxyc-shared** (`@wxyc/shared`): Shared DTOs, auth client, validation. Published to GitHub Packages. Used for type definitions and auth integration
- **tubafrenzy**: Legacy Java flowsheet. The current database schema originates from here

## Example Music Data for Tests

WXYC is a freeform station. When creating test fixtures or mock data, use representative artists instead of mainstream acts like Queen, Radiohead, or The Beatles. The canonical data source is `wxyc-shared/src/test-utils/wxyc-example-data.json`. See the reference table in the org-level CLAUDE.md.

### Recommended Defaults for Factory Functions

When overriding factory function defaults or creating new test data, prefer these WXYC-representative values:

```typescript
// Instead of generic "Test Artist" / "Test Album" defaults, use real WXYC catalog data:

createTestArtist({ name: "Juana Molina", lettercode: "RO", numbercode: 42, genre: "Rock" })
createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87, genre: "Rock" })
createTestArtist({ name: "Cat Power", lettercode: "RO", numbercode: 23, genre: "Rock" })
createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 112, genre: "Rock" })
createTestArtist({ name: "Chuquimamani-Condori", lettercode: "EL", numbercode: 15, genre: "Electronic" })
createTestArtist({ name: "Duke Ellington & John Coltrane", lettercode: "JA", numbercode: 7, genre: "Jazz" })

createTestAlbum({
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina", lettercode: "RO", numbercode: 42 }),
  label: "Sonamos",
  format: "CD",
})

createTestAlbum({
  title: "Moon Pix",
  artist: createTestArtist({ name: "Cat Power", lettercode: "RO", numbercode: 23 }),
  label: "Matador Records",
  format: "CD",
})

createTestAlbum({
  title: "On Your Own Love Again",
  artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 112 }),
  label: "Drag City",
  format: "Vinyl LP",
})

createTestFlowsheetEntry({
  artist_name: "Juana Molina",
  album_title: "DOGA",
  track_title: "la paradoja",
  record_label: "Sonamos",
})

createTestFlowsheetEntry({
  artist_name: "Duke Ellington & John Coltrane",
  album_title: "Duke Ellington & John Coltrane",
  track_title: "In a Sentimental Mood",
  record_label: "Impulse Records",
  request_flag: true,
})

createTestFlowsheetQuery({
  artist: "Chuquimamani-Condori",
  album: "Edits",
  song: "Call Your Name",
  label: "self-released",
})

createTestAlbumQueryResponse({
  artist_name: "Stereolab",
  album_title: "Aluminum Tunes",
  code_letters: "RO",
  code_artist_number: 87,
  genre_name: "Rock",
  label: "Duophonic",
})
```
