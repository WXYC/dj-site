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

- **`renderWithProviders(ui, options?)`** -- Wraps component in Redux `Provider` + MUI `CssVarsProvider`. Returns `{ ...rtlResult, store, user }`. Accepts `preloadedState` and custom `store`.
- **`createTestStore()`** -- Creates a fresh `AppStore` instance.

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
| `createTestSessionWithOrgRole(role)` | `BetterAuthSession` | Session with specific org role |
| `createTestBetterAuthJWTPayload(overrides?)` | `BetterAuthJwtPayload` | JWT claims |
| `createTestAccountResult(overrides?)` | `Account` | Admin roster account |
| `createTestBinQueryResponse(overrides?)` | `BinQueryResponse` | Bin entry |
| `createTestOnAirDJResponse(overrides?)` | On-air DJ object | `{ id, dj_name }` |

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

- `lib/__tests__/features/<feature>/` -- Slice tests, API structure tests, conversion tests
- `src/components/**/*.test.tsx` -- Component tests (co-located with the component)
- `tests/` -- Additional component and capability tests

## Test Conventions

- Use `it.each` for parameterized tests
- Use the slice harness for all Redux slice tests
- Use the API harness for verifying RTK Query endpoint structure
- Use `createTest*` factory functions instead of inline test data
- Reference `TEST_ENTITY_IDS` and `TEST_SEARCH_STRINGS` constants for IDs and strings
- Use `renderWithProviders` for all component tests (never bare RTL `render`)
