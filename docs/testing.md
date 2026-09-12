# Testing

## Setup

Vitest config is in `vitest.config.mts`; the suite runs as node and jsdom projects (see [Environments](#environments)). Global setup in `tests/setup/vitest.setup.ts` handles:
- MSW server lifecycle (`beforeAll`/`afterEach`/`afterAll`) — both environments
- `localStorage` and `EventSource` mocks on `globalThis` — both environments
- `matchMedia` mock (required by MUI) — jsdom only
- `ResizeObserver` mock (required by MUI) — jsdom only

Globals are enabled (`describe`, `it`, `expect` available without import, though explicit imports from `vitest` are the convention used in this codebase).

## Test Utilities (`tests/helpers/`)

Component specs -- anything that needs `renderWithProviders`, `user`, or one of the
slice/API/component harnesses -- import everything from `@/tests/helpers`:

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
and server (`tests/fakes/`), and fixture factories (`tests/fixtures/`). Importing any
one of those names evaluates the whole graph -- Redux, all 13 RTK Query APIs, and MUI
Joy -- because `render.tsx` sits in the same barrel.

DOM-free specs (`tests/unit/`, `tests/contract/`) whose only need is fixtures,
constants, or the conversion harness should import those modules directly instead of
going through the barrel, since the barrel's render/store cost is otherwise paid for
nothing:

```typescript
import { createTestAlbum, createTestArtist } from "@/tests/fixtures/fixtures";
import { TEST_ENTITY_IDS, TEST_SEARCH_STRINGS } from "@/tests/helpers/constants";
import { describeConversion } from "@/tests/helpers/conversion-harness";
```

A spec that also needs `server`, `createTestStore`, or a slice/API harness already
pays the barrel's cost and should just import everything from `@/tests/helpers` --
splitting the fixture import out in that case saves nothing.

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
TEST_ENTITY_IDS.LEGACY_RELEASE.ROCK_ALBUM  // 7001 -- same row, other id space
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

`tests/helpers/classic-page-authority-harness.ts` covers the `requireAuth()` -> `requireRole()` gate that every page under `app/dashboard/@classic/**` runs in front of its screen-specific content. The dynamic imports inside the `vi.mock` factories must name the harness by path — factories cannot close over statically-imported bindings. The top-level static import of the setUp/assert functions is ordinary; it targets the harness module directly because the `@/tests/helpers` barrel does not re-export it.

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

// The page renders through Layout/Main -> Navigation, which reaches the real
// better-auth client through useLogout(). Replace the nav rather than pulling
// a live auth client into a server-component test; a page whose own nav is
// under test would use createAuthClientModuleMock() instead.
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
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
- **`setUpClassicPageAuthority(role, adminPluginRole?)`** -- arranges the session/org-role mocks for one scenario. `role` is the WXYC tier the org-role resolver returns — any `WXYCRole`, plus `"unauthenticated"` and `undefined` (the type is derived from `WXYCRole`, so a tier added upstream is testable here without editing the harness). `undefined` is a valid session with no station role -- `requireRole` denies it to the dashboard home; `"unauthenticated"` is no session at all -- `requireAuth` denies it to `/login?bounced=no-session` before role resolution runs. `adminPluginRole` models a WXYC tier string leaking into the unrelated better-auth admin-plugin session column, which must never grant access on its own.
- **`assertReachesClassicPage(page, ...landmarkTestIds)`** -- awaits and renders the page, then asserts no redirect happened AND every named landmark testid is in the document. Checking only "no redirect" passes vacuously for a page that renders nothing, so it can't distinguish "allowed and working" from "allowed and broken" -- the signature requires at least one landmark (the page's own screen-specific one) for exactly that reason.
- **`assertDeniedClassicPage(page, destination?)`** -- asserts the page denies access by redirecting to `destination`, which defaults to `DEFAULT_DASHBOARD_HOME_PAGE` (the same constant the env pin uses, so the two can't drift apart).

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

A fake that has to answer differently across a sequence of requests gets its own module rather than an inline handler. `tests/fakes/playlistSearch.ts` is the pattern: it holds an archive, serves pages out of it under whichever pagination mode the request's sort implies, and records every request it saw, so a spec can assert the shape of a whole multi-page walk. Opt in with `server.use(fake.handler)`.

**Rotation fake** (`tests/fakes/rotation.ts`, re-exported from `@/tests/helpers`): a stateful stand-in for `GET`/`POST`/`PATCH /library/rotation` -- the list is the source of truth an add appends to and a kill removes from, so a consuming control's state travels back through the list exactly as it does in production instead of being handed to it directly.

```typescript
import { fakeRotationEndpoints } from "@/tests/helpers";

const backend = fakeRotationEndpoints([existingRow], {
  // Owns the fixture shape (album id, artist, format, ...); the fake only owns
  // the add/kill/list state machine.
  buildRow: (rotationBin) => ({ ...existingRow, rotation_bin: rotationBin }),
});

// backend.addBody() -- the last POST body
// backend.killBodies() -- every PATCH body, in call order
// backend.callOrder() -- every write as "add" | "kill", in one sequence
// backend.listRequests() -- GET call count
```

`callOrder()` exists because the add-before-retire order of the set gesture is a safety property -- retiring first and then failing the add drops the album out of rotation entirely -- and per-arm logs cannot express an ordering between two arms.

The PATCH arm mirrors the backend's `isISODate` gate, rejecting any `kill_date` that isn't a bare `YYYY-MM-DD`. `fakeRotationEndpointsWithGatedKill(initial, { buildRow })` is the same GET/POST/PATCH shape but holds each PATCH open until the test calls `releaseKill(rotationId?)`, for asserting on in-flight busy state instead of racing a same-tick MSW response; it takes `buildRow` for the same reason the un-gated fake does, since a set reaches POST before it reaches PATCH.

One deliberate gap: a kill *removes* the row rather than stamping `kill_date` on it, so neither fake reproduces the production read's retention of a future-dated kill. Every consumer derives membership from the rows the list returns, so retaining a killed row would read as still active -- modelling that needs the GET arm to apply the backend's kill_date-in-the-future filter alongside the field, and no spec needs it yet.

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

### Environments

The suite runs as three vitest projects defined in `vitest.config.mts`: `node` (the `tests/unit/lib` and `tests/contract` tiers), `jsdom` (everything outside those tiers), and `jsdom-lib` (the handful of lib specs pinned to a DOM). The split exists because jsdom is constructed per test file, and the two node-tier directories never touch the DOM -- routing them to node removes that per-file cost from ~125 files without changing what any test asserts.

The pinned specs are the `tests/unit/lib` files that reach a real `window` (storage specs asserting through `Object.defineProperty(window, ...)`, spies on the `window` global), listed in `DOM_DEPENDENT_LIB_TESTS` in `tests/setup/vitest-projects.ts` (shared with the config's own test, which cannot import an `.mts` config directly). Every project's include/exclude is a static pattern or that literal list -- never a glob resolved at config load -- because watch mode routes a newly created file by matching each project's patterns, and a materialised list would claim new specs by when vitest started rather than where the file lives. The pinned specs get a project of their own because a vitest exclude beats an include naming the same file: the main jsdom project blanket-excludes the two node tiers and cannot carve individual files back in. `tests/unit/vitest.config.test.ts` asserts every pinned entry names a real file in a node-tier directory, so a renamed pin fails the config test instead of silently rerouting to the node project.

When adding a lib spec that needs a browser global, prefer stubbing it on `globalThis` (the pattern `vitest.setup.ts` uses for `EventSource` and `localStorage`) so it stays in the node project; add it to `DOM_DEPENDENT_LIB_TESTS` only when the test's subject is genuinely the `window` binding itself.

`tests/setup/vitest.setup.ts` runs for all three projects: its DOM-dependent stubs (`matchMedia`, `ResizeObserver`, `scrollIntoView`, `IntersectionObserver`) sit behind a `typeof window !== "undefined"` guard, while the `localStorage` and `EventSource` stubs (on `globalThis`) and the MSW `server.listen` lifecycle apply everywhere. CI's `--changed` and `--shard` invocations operate across all projects' merged file sets.

## Test Conventions

- Use `it.each` for parameterized tests
- Use the slice harness for all Redux slice tests
- Use the API harness for verifying RTK Query endpoint structure
- Use `createTest*` factory functions instead of inline test data
- Reference `TEST_ENTITY_IDS` and `TEST_SEARCH_STRINGS` constants for IDs and strings
- Keep an album fixture's `legacy_release_id` **distinct from its `id`**. They are two id spaces over the same row — `id` is Backend's `library.id` serial, `legacy_release_id` is the tubafrenzy `LIBRARY_RELEASE_ID` the per-track store is keyed by — and a fixture where the two coincide cannot tell a path that resolves in the right space from one that resolves in the wrong space. Pair an `TEST_ENTITY_IDS.ALBUM` id with the `TEST_ENTITY_IDS.LEGACY_RELEASE` entry of the same name; never copy one into the other. This applies to hand-built rows too, including wire-shaped ones (`createTestAlbumSearchResult`), where the type is optional and the compiler will not ask
- Use `renderWithProviders` for all component tests (never bare RTL `render`)
- Putting a value in a field is *arrange* or *subject* — pick the tool accordingly. When a spec only needs the field to end up holding a value, call `setFieldValue(field, value)` from `tests/helpers`: one `change` event, no keystrokes, so it can't drive keydown/keyup-driven behavior. When the keystroke stream itself is what the spec asserts on, use `user.type` and say so in a one-line comment next to the call. Known cases that must stay typed: the progressive-validation username checks in `StationSignupForm.test.tsx`, the diacritic round-trip in `VaTracklistStep.test.tsx`, and the `" Solo"` append onto an already-picked artist in `AddReleasePanel.test.tsx`.
