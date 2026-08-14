# Testing

## Setup

Vitest config is in `vitest.config.mts`. Global setup in `tests/setup/vitest.setup.ts` handles:
- MSW server lifecycle (`beforeAll`/`afterEach`/`afterAll`)
- `localStorage` mock
- `matchMedia` mock (required by MUI)
- `ResizeObserver` mock (required by MUI)

Globals are enabled (`describe`, `it`, `expect` available without import, though explicit imports from `vitest` are the convention used in this codebase).

## Test Utilities (`tests/helpers/`)

Import everything from `@/tests/helpers`:

```typescript
import {
  renderWithProviders,
  createTestAlbum,
  createTestFlowsheetEntry,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/tests/helpers";
```

The barrel re-exports render helpers and harnesses (`tests/helpers/`), MSW handlers
and server (`tests/fakes/`), and fixture factories (`tests/fixtures/`).

### Rendering

- **`renderWithProviders(ui, options?)`** -- Wraps component in Redux `Provider` + MUI `CssVarsProvider`. Returns `{ ...rtlResult, store, user }`. Seed state with `preloadedState` (the store is built for you). If you need to share a store across multiple renders or interact with it before rendering, build it yourself with `createTestStore(preloadedState?)` and pass it as `store`. `store` and `preloadedState` are mutually exclusive -- passing both is a compile error, since a supplied store already has its own state and `preloadedState` would be silently discarded.
- **`createTestStore(preloadedState?)`** -- Creates a fresh `AppStore` instance, optionally seeded.

### Factory Functions

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
| `createTestSessionWithRole(role)` | `BetterAuthSession` | Session with a role on `session.user.role` — the admin-plugin column, for `betterAuthSessionToAuthenticationData` tests only |
| `createTestAccountResult(overrides?)` | `Account` | Admin roster account |
| `createTestBinQueryResponse(overrides?)` | `BinQueryResponse` | Bin entry |
| `createTestOnAirDJResponse(overrides?)` | On-air DJ object | `{ id, dj_name }` |
| `createTestInsertWirePayload(overrides?)` | `InsertWirePayload` | Raw SSE `LiveFsInsertEvent` row (nullable-widened `FlowsheetEntryResponse`) |

List factories: `createTestAlbumList(count?)`, `createTestFlowsheetEntryList(count?)`

Message factories: `createTestStartShowMessage(djName?, dateTime?)`, `createTestEndShowMessage(djName?, dateTime?)`, `createTestBreakpointMessage(time?)`

### Test Constants

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

### Time Utilities

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

### Test Harnesses

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

### Classic Page Authority Harness

`tests/helpers/classic-page-authority-harness.ts` covers the
`requireAuth()` -> `requireRole()` gate that every page under
`app/dashboard/@classic/**` runs in front of its screen-specific content.
The dynamic imports inside the `vi.mock` factories must name the harness by path — factories cannot close over statically-imported bindings. The top-level static import of the setUp/assert functions is ordinary; it targets the harness module directly because the `@/tests/helpers` barrel does not re-export it.

```tsx
import {
  setUpClassicPageAuthority,
  setUpClassicPageAuthorityEnv,
  assertReachesClassicPage,
  assertDeniedClassicPage,
} from "@/tests/helpers/classic-page-authority-harness";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => {
  const { classicPageAuthorityHeadersMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityHeadersMock();
});
vi.mock("next/navigation", async () => {
  const { classicPageAuthorityNavigationMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityNavigationMock();
});
vi.mock("@/lib/features/authentication/server-client", async () => {
  const { classicPageAuthorityServerClientMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityServerClientMock();
});
vi.mock("@/lib/features/authentication/organization-utils.server", async () => {
  const { classicPageAuthorityOrganizationUtilsMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityOrganizationUtilsMock();
});

// Mock the page's own screen content so the landmark below proves the page
// rendered, not just that it exists.
vi.mock("@/src/components/experiences/classic/library/MissingReleases", () => ({
  default: () => <div data-testid="missing-releases-table" />,
}));

import ClassicMissingReleasesPage from "@/app/dashboard/@classic/library/missing/page";

describe("Classic /dashboard/library/missing page", () => {
  setUpClassicPageAuthorityEnv();

  it("reaches the page for a DJ", async () => {
    setUpClassicPageAuthority("dj");
    await assertReachesClassicPage(ClassicMissingReleasesPage, "missing-releases-table");
  });

  it("redirects a member with no station role", async () => {
    setUpClassicPageAuthority(undefined);
    await assertDeniedClassicPage(ClassicMissingReleasesPage);
  });
});
```

- **`setUpClassicPageAuthorityEnv()`** -- registers the `beforeEach`/`afterEach` that reset the mocks and pin `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` so redirect assertions are deterministic. Call once per `describe` block.
- **`setUpClassicPageAuthority(role, adminPluginRole?)`** -- arranges the session/org-role mocks for one scenario. `role` is the WXYC tier the org-role resolver returns (`"dj" | "musicDirector" | "stationManager" | "unauthenticated" | undefined`). `undefined` is a valid session with no station role -- `requireRole` denies it to the dashboard home; `"unauthenticated"` is no session at all -- `requireAuth` denies it to `/login?bounced=no-session` before role resolution runs. `adminPluginRole` models a WXYC tier string leaking into the unrelated better-auth admin-plugin session column, which must never grant access on its own.
- **`assertReachesClassicPage(page, ...landmarkTestIds)`** -- awaits and renders the page, then asserts no redirect happened AND every named landmark testid is in the document. Checking only "no redirect" passes vacuously for a page that renders nothing, so it can't distinguish "allowed and working" from "allowed and broken" -- the signature requires at least one landmark (the page's own screen-specific one) for exactly that reason.
- **`assertDeniedClassicPage(page, destination?)`** -- asserts the page denies access by redirecting to `destination` (defaults to `/dashboard`).

### Auth Client Mock

`createAuthClientModuleMock()` (`tests/helpers/auth-client-mock.ts`) replaces `@/lib/features/authentication/client` with an unauthenticated session. Every test that renders a component reaching `useAuthentication` — directly, or through `useRegistry` / `useBin` / `usePlayNow` — must use it. Letting the real module instantiate installs a better-auth session store whose teardown is deferred a second past the last subscriber; a short test file finishes inside that second, the deferred teardown then runs against removed jsdom globals, and the resulting `window is not defined` is reported as an unhandled error that fails the run with every test green.

```typescript
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});
```

Import the helper by path inside the factory: `vi.mock` factories cannot close over imports, and the `@/tests/helpers` barrel pulls in the Redux store, which imports the module being replaced.

### MSW Setup

Default handlers in `tests/fakes/handlers.ts` return empty responses for `/library/`, `/authentication/`, `/flowsheet/`, `/rotation/`. Override in individual tests:

```typescript
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL } from "@/tests/helpers";

server.use(
  http.get(`${TEST_BACKEND_URL}/library/`, () => {
    return HttpResponse.json([createTestAlbumQueryResponse()]);
  })
);
```

## Test Organization

Tests are never co-located with source. Every vitest test lives under `tests/`, mirroring the path of the source it covers:

- `tests/unit/` -- Slice tests, API structure tests, conversion tests, pure utilities
- `tests/integration/` -- Component tests and multi-module behaviour
- `tests/contract/` -- Wire-shape contracts (charset round-trip, backend soft-fail) and bundled-asset budget guards
- `tests/helpers/` -- Factories and harnesses
- `tests/fakes/` -- MSW handlers
- `tests/fixtures/` -- Static fixture data
- `tests/setup/` -- Vitest setup files

Playwright specs stay in `e2e/`, and bats scripts in `scripts/__tests__/`.

## Test Conventions

- Use `it.each` for parameterized tests
- Use the slice harness for all Redux slice tests
- Use the API harness for verifying RTK Query endpoint structure
- Use `createTest*` factory functions instead of inline test data
- Reference `TEST_ENTITY_IDS` and `TEST_SEARCH_STRINGS` constants for IDs and strings
- Use `renderWithProviders` for all component tests (never bare RTL `render`)
