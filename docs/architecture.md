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

## Dashboard URL map

`/dashboard` is a parallel-route tree: `ThemedLayout` renders the `@classic` **or** the `@modern` slot for the **same URL**, chosen by the viewer's experience preference. A URL is therefore not owned by one experience — every URL has two slots, and both must render something.

**Neither slot may render `null`.** A slot with no page for the current URL falls through to its `default.tsx`, which renders `ExperienceGap`: a named statement that the screen belongs to the other experience, plus a one-click switch. Because the fallback lives in `default.tsx` rather than per-route stub files, a new single-slot route is covered by the counterpart slot automatically.

### Librarian (card catalog) screens

These reproduce tubafrenzy's `/wxycdb` screens. They are **classic-first**: the classic slot holds the real screen and the modern slot falls through to `ExperienceGap`.

| URL | Screen | `/wxycdb` source | Authority |
|---|---|---|---|
| `/dashboard/library` | Entry: artist vs. Various Artists, multi-match disambiguation | `chooseLibraryCodeOrArtist.jsp`, `multipleArtistsDisplay.jsp` | MD |
| `/dashboard/library/artist/new` | Code-miss create screen: genre/letters/numbers carried read-only from the miss branch, only the two name fields editable | `createLibraryCode.jsp` | MD |
| `/dashboard/library/artist/[id]` | Artist card + its release list | `artistCardModify.jsp` | MD |
| `/dashboard/library/various/[id]` | V/A bucket card + its add-release form | `variousArtistsCardModify.jsp` | MD |
| `/dashboard/library/release/[id]` | Release edit | `libraryReleaseModify.jsp` | MD |
| `/dashboard/library/release/[id]/move` | Move release to another library code | `libraryReleaseModifyLibCode.jsp` | MD |
| `/dashboard/library/release/[id]/delete` | Delete confirmation | `libraryReleaseDelete.jsp` | MD |
| `/dashboard/library/release/[id]/tracklist` | Per-track artist credits for a Various Artists release: Discogs fills the form, the librarian confirms | none (the JSP's tracklist is read-only) | MD |
| `/dashboard/library/missing` | Missing releases | `missingReleases.jsp` | **authenticated DJ** |
| `/dashboard/rotation` | Rotation release list | `rotationReleaseList.jsp` | **authenticated DJ** |
| `/dashboard/rotation/new` | Add rotation release | `rotationReleaseInsert.jsp` | MD |
| `/dashboard/rotation/[id]` | Modify rotation release | `rotationReleaseModify.jsp` | MD |
| `/dashboard/rotation/[id]/import` | Import rotation release into the library | `rotationReleaseImport.jsp`, `rotationReleaseImportNewArtist.jsp` | MD |

Which of the two artist cards a link opens is decided structurally, by `code_letters`, in `lib/features/catalog/artistCardRoute.ts` — `/wxycdb` serves both from one servlet and picks the view from the row, and that choice has to be reproduced wherever a link to an artist is built. Deciding it on the artist's *name* would drop the whole `Soundtracks - <A–Z>` sub-shelf, which carries no compilation keyword anywhere. Both cards also redirect a row that belongs on the other one, so a hand-typed or stale URL still lands on the screen that describes it.

The bucket card's and the release editor's **Album Artist** rows are both display-only: `library.album_artist` is written solely by the nightly catalog import. `PATCH /library/:id` omits the field from its updatable whitelist deliberately; `POST /library`'s published schema does declare `album_artist`, but no Backend write path reads it, so sending one is discarded silently. Both rows state that rather than offering an input that would throw away what is typed. They become inputs once a write path exists — the add path needs its schema and its implementation reconciled first, in either direction.

**Moving a release to another library code picks the destination by code, not from a list of every artist.** `libraryReleaseModifyLibCode.jsp` renders `allArtists` into a single `<select>`. No all-artists endpoint exists to back that, and at the catalog's size the control would be unusable if one did. `GET /library/artists/by-code` answers what the select was really for — who holds this code — and answers it better on the case that matters: a compilation code is held by many artists at once (`V/A`/12/0 has 27 owners), which a scrolling select cannot disambiguate and an owner list can. Composition of the `(genre_id, code_letters, code_number)` triple stays with `composeLibraryCodeSearchArgs`, the same owner the chooser uses. The bound to state honestly: this replaces picking a destination **by code**, not by name. A librarian who knows the destination artist but not its code has to look the code up elsewhere first — `GET /library/artists/search` would back a name picker and is already wrapped as a hook, so that is deferred work rather than something the contract forbids. A resolved destination is retired whenever the code that named it changes, and each lookup is stamped so an answer arriving after an edit is dropped: only the Look-up button is disabled while a request is in flight, so without the stamp an in-flight answer could re-arm an artist the screen no longer shows and the move would file against it.

The move sends `genre_id` alongside `artist_id`, always. `PATCH /library/:id` validates the *effective* pair — `artist_id ?? existing.artist_id` against `genre_id ?? existing.genre_id` — so a move to an artist in a different genre, sent as `artist_id` alone, is rejected as "Artist is not catalogued in the selected genre": a 400 for a move the librarian spelled out correctly. The destination genre is free here, being the genre the code was looked up in. Backend also keeps the release's `code_number` across the move unless the destination artist already owns that number, in which case it burns the next one in that artist's sequence — so Release Call Number is read-only on both screens (the endpoint accepts neither it nor the call letter) and the move's confirmation says the number may have changed rather than implying the one on screen survived. A re-attribution also widens what `updateAlbum` invalidates: an ordinary field edit is patched into the cached rows in place, but a change of `artist_id` leaves both the artist the release came from and the one it joined holding a stale release table, and leaves the row in cached artist-name searches it no longer matches. The source artist is not in the mutation's args, so the release tables are reached through their shared `LIST` tag rather than by id.

**The classic librarian screens are confirmation surfaces, not data-entry ones.** The material is autopopulated and the screen exists to let the librarian finalize what looks like a card-catalog entry. This is what "the JSP is the design spec" actually means, and it is easy to invert: the JSP fixes what he *sees* — layout, field order, labels, terminology — not how much he types. A faithful-looking screen that makes him hand-enter what a machine could fill fails the spec rather than honouring it, and where a JSP has no equivalent screen at all the default is to autopopulate and let him confirm, not to build a conventional blank form.

Per-track credits are the worked example. `/dashboard/library/release/[id]/tracklist` issues a standing `getCompilationTrackSuggestions` query and seeds its rows from Discogs before the librarian sees anything, excluding whatever is already on file — nobody is going to type twenty per-track artists, and the write endpoint is additive, so re-offering a filed credit invites a correction that lands beside the original. Hand entry survives for exactly three cases and they are kept strictly apart: Discogs answering with nothing, Discogs answering with only what is already on file, and Discogs not answering at all. Collapsing the third into the first is what costs a librarian a hand-typed tracklist for a release Discogs would have supplied on a retry, so the outage state offers a retry first and reaches manual entry only as an explicit choice; collapsing the second into the first costs him one that is already sitting in the table above the form. Modern reaches the same screen through `CompilationCreditsControl` on the album card, and the two experiences now hold the same feature rather than half of it each. `VaTracklistStep` is the one implementation both modern surfaces render, so the outage/no-match distinction cannot drift between them; the difference between an add and an edit is a single prop, `mayAlreadyHoldCredits`. It defaults to the conservative reading and the add-release panel is the only caller entitled to claim otherwise — for the moments after it creates a release, before any write has been attempted, nothing can be on file, and that claim buys one skipped request. An attempt forfeits it: a write can commit and then fail to deliver its response. Everywhere else the stored-credit read is unconditional, and saving is refused until it succeeds.

**Deleting a release is refused server-side, not pre-checked here.** `libraryReleaseModify.jsp` hides its delete link when the release has cross-references; the classic editor offers it unconditionally. `DELETE /library/:id` is a hard delete that refuses a release carrying flowsheet plays, which is both a stronger criterion than the JSP's and one the JSP deleted straight through — and it is evaluated at the moment of the write, where it cannot go stale between a check and a click. So the confirmation screen has three refusals to tell apart, and `lib/features/catalog/releaseDeleteOutcome.ts` is their one owner: a `409` is refused on the merits and withdraws the button, a `503` is a stand-down on a locked row that says nothing about deletability and keeps it, and a `404` is almost always the second click of a double-submit. Anything else splits again on whether the server answered at all: a sub-500 reply reached a handler that declined before writing, so "nothing was changed" is safe to say, while a 5xx, a dropped connection, or an unparseable body leaves the outcome genuinely unknown — the delete may have committed on a response that never arrived. That case says so and keeps the button, since a second press on a deleted row returns 404 and reads as "already gone". `deleteAnsweredWithoutWriting` owns that distinction for both the message and the cache: a lost answer still invalidates, or every cached list would keep asserting a release that is gone. On an irreversible screen, "the server said no", "we could not tell what the server said", and "we never heard back" must not look alike. The delete deliberately does **not** invalidate `AlbumDetail`: that tag would refetch a row that no longer exists, and the guaranteed 404 reaches `rtkQueryErrorLogger` as a red toast over the confirmation screen plus a Sentry event, on every successful delete. A tag refreshes a stale read; after a hard delete there is nothing left to read, and the lists that could still surface the row are invalidated instead. The refusal sentence itself comes from the server, against the house convention of the screen owning its words, because its content is a play count and a three-way path breakdown the client cannot recompute without duplicating logic that would drift.

Naming follows `/wxycdb`'s own directory split (`libraryAdmin/`, `rotation/`) rather than nesting under `/dashboard/catalog`, which would collide confusingly with the unrelated modern `/dashboard/admin/catalog` (format + genre admin).

`createArtist.jsp` is deliberately absent from this table: `ArtistAdminServlet:250` renders it only as the post-*delete* restore screen ("you may restore the artist by clicking 'Add!'"), not a creation step, so no row here owns it. It travels with artist delete if a slice ever picks that up.

### Authority is per screen

`mainmenu.jsp` wraps only add/edit/delete and the cross-reference views in `hasAdminAccess()`. Missing Releases and both rotation links sit **outside** that block, and Backend agrees: `GET /library/rotation` and `PATCH /library/:id/missing|found` are gated at `catalog: ['read']` while `POST`/`PATCH /library/rotation` require `catalog: ['write']`. Mark Missing / Mark Found is deliberately DJ-accessible and must never be MD-gated.

Two rows diverge from the JSP, deliberately:

- **`/dashboard/rotation/new`, `/[id]`, `/[id]/import` are MD**, though `mainmenu.jsp` does not admin-gate them. Backend requires `catalog: ['write']` for every rotation write, so an ungated page would render a full form to a DJ and fail at submit. Gating the page is the honest surface.
- **`/dashboard/catalog` stays authenticated-DJ in both slots.** It is classic's DJ-facing search page. The modern slot has no server gate at all — `@modern/catalog/page.tsx` calls neither `requireAuth` nor `requireRole`, relying on `RequireMD` inside its panels — so adding `requireRole(MD)` to serve the librarian entry point here would break classic DJ search. The librarian entry point is `/dashboard/library`, a distinct URL.

Page authority is **server-side** (`requireAuth` + `requireRole` in the page component), matching `@modern/admin/catalog/page.tsx`. `AuthorizedView` / `RequireMD` is a client component and hides affordances only; it is never the gate.

The dashboard layout (`app/dashboard/layout.tsx`) sits in front of these gates on a full-document load and reads the session three ways, not two: a valid session, a genuinely absent/invalid one (redirects to `/login?bounced=no-session`, as before), or a read that failed to resolve at all — rate limited, an upstream 5xx, or a transport failure. That third outcome does not redirect; the layout renders `SessionUnavailable` in place of the `@classic`/`@modern`/`@information` slots instead, so a transient auth-server problem does not sign a DJ out mid-show. Page-level `requireAuth()` calls are unaffected and keep redirecting on a failed read, since they have no notice surface of their own — but under their own `bounced=session-unavailable` reason, not `no-session`, so `SessionEndedNotice` tells the DJ their session may still be valid instead of falsely announcing it ended.

The layout gate is the first line, not the only one. Layouts above the changed segment are not re-executed on client-side navigation, so a DJ already on a dashboard route who soft-navigates to a gated page during an auth-server outage runs that page's `requireAuth()`/`requireRole()` without re-running the layout's, and still gets bounced to `/login` — honestly labeled, but still off the page. Closing that residue needs a page-level notice surface that keeps the DJ in place, the way the layout branch does; the distinct bounce reason alone cannot cover it.

### Existing dual-slot URLs

| URL | Classic slot | Modern slot | Authority |
|---|---|---|---|
| `/dashboard/catalog` | Card catalog search | Card catalog search + MD add panels | authenticated DJ |
| `/dashboard/flowsheet` | Flowsheet | Flowsheet | authenticated DJ |
| `/dashboard/playlists` | Previous sets | Previous sets | authenticated DJ |
| `/dashboard/help` | Help | `ExperienceGap` | authenticated DJ |
| `/dashboard/admin/catalog` | `ExperienceGap` | Format + genre admin | MD |
| `/dashboard/admin/roster` | `ExperienceGap` | Roster admin | SM |

### Previous sets: two views behind one URL

`/dashboard/playlists` serves a searchable listing and a weekly schedule grid from the same route, in both experiences. The grid is the internal successor to tubafrenzy's `wxyc.info/playlists/radioWeek`.

**URL state, not Redux.** Three parameters, read by `useScheduleWeekParams` in `src/hooks/scheduleWeekHooks.ts`:

| Parameter | Values | Meaning |
|---|---|---|
| `view` | `week`, or absent | Which view renders. Absent is the searchable listing. |
| `week` | `YYYY-MM-DD` | Any date in the wanted week; normalized to that week's **Sunday**, station time. An unparseable value falls back to the current week and never silently resolves to a different one. |
| `show` | show id | The show whose entries are expanded. Cleared when the week changes, since the id belongs to the week that produced it. |

They live in the URL because a DJ sending a colleague a specific week is the obvious use and it makes back/forward work; three scalars do not justify a slice.

**Server/client split.** The page stays a Server Component so it can seed the default listing (`fetchRecentPlaylistsSeed`), and renders `PreviousSetsSurface`, a client component that owns the Search-vs-Week branch. The branch cannot live on the server: `useSearchParams` is client-only, and branching server-side would make every toggle click a round-trip. The seed is fetched even when the URL asks for the week view — one 50-row request, accepted deliberately as the price of a client-side toggle. `ThemedLayout`'s existing Suspense boundary covers `useSearchParams`; no new boundary is added.

**`lib/features/schedule-week/`** departs from the standard slice shape below: it has no `frontend.ts` (no Redux state) and adds `layout.ts`, a pure grid model kept out of React so the genuinely hard parts — DST-uneven day lengths, midnight spans, unclosed shows, overlaps — are testable without rendering.

`scheduleWeekApi` is registered in `lib/store.ts` **only, never `lib/store-public.ts`**. The view renders historical `dj_name` values that resolve under a pre-BS#1286 chain and can hold real names; it is safe because it sits behind the dashboard auth gate, which holds only if its data layer never reaches a public route's bundle. `playlistSearchApi` is in both stores, so copying its registration is the obvious wrong move — `tests/unit/lib/store.test.tsx` asserts the exclusion.

**Two traps in `GET /flowsheet/range` that the UI has to absorb:**

- `shows` is returned on *overlap* but `entries` is filtered on `add_time`, so a show straddling the week edge arrives complete in the grid and truncated in the entry stream. Every week has one — the show on the air at Sunday midnight. `useShowEntries` detects the uncontained span, fetches the show's own window, and merges by entry id; if that request fails the panel says the list is partial rather than presenting the fragment as the whole set.
- A null `end_time` means either "on the air" or "sign-off was dropped and the column stayed null permanently", and the two are indistinguishable from the field. It resolves from the `show_end` marker row, then clips to now only for a show that began within the last day, and otherwise draws at minimum height with an open bottom edge.

### Classic stylesheets

Classic reproduces tubafrenzy's screens, so its CSS is organised by the surface it mirrors rather than by component. All of it lives in `src/styles/classic/` and is imported by the component that needs it.

| File | Mirrors |
|---|---|
| `wxyc.css` | Shared shell: `.bigblue`, `.smalltext`, `.redlabel`, and the dark-scheme overrides |
| `flowsheet.css` | The DJ flowsheet |
| `previous-sets.css` | `public/searchPage.jsp` + `mostRecentEntries.jsp` |
| `schedule-week.css` | `jsp/public/flowsheetRadioWeekDisplayPublic.jsp` + the `radioWeek` rules in `playlists.css` |
| `capsules.css`, `actions.css`, `drag.css`, `segue.css` | Catalog and flowsheet interaction affordances |
| `login.css` | The login screen |

The weekly-schedule stylesheet reproduces the source's class names exactly — `.radioWeekHeader`, `.radioDayHeader`, `.radioShowDisplayBlock`, `.radioDayNonshow`, `.radioDayLine`, `.endOfDay` — and tests assert every one is still emitted, because the screen's visual parity rests on them and a rename would change the page silently rather than break it. The five the grid owns are guarded on `ClassicWeekGrid`; `.radioWeekHeader` belongs to the week container and is guarded there. A class added to that list needs a guard added with it, or the list stops being a claim about the code.

Two deliberate departures from the source JSP:

- **Percentages, not the JSP's absolute pixels.** The original positioned everything on a fixed 905px canvas at 1px per two minutes (`left: 25 + 130n`, `height: 720`). That cannot survive a narrow viewport, so the geometry is a grid; the rendered result it was recognised by is preserved.
- **Blocks are buttons.** The source's `<a href="radioWeek?…">` has no route here, and its practice of printing no label under 44 minutes left slivers with no accessible name at all. Short blocks now keep their name even when they cannot show it.

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
- **Experiences**: Two UI themes (modern/classic), separated by directory under `src/components/experiences/{classic,modern}` rather than by a filename prefix. The experience system uses a registry pattern (`lib/features/experiences/registry.ts`)
- **No ESLint/Prettier config**: No formatter or linter configuration files exist at the project level. Follow existing code style
- **Strict TypeScript**: `strict: true` in tsconfig
- **Onboarding completeness**: Tracked via the `hasCompletedOnboarding` boolean on the user record, not by presence of profile fields (`realName`/`djName`). This allows admins to pre-fill profile fields when creating accounts without bypassing onboarding. A user is incomplete when `hasCompletedOnboarding !== true` (including when the flag is absent/undefined). The `isUserIncomplete()` function in `server-utils.ts` checks this predicate; `getIncompleteUserAttributes()` still inspects `realName`/`djName` to determine which form fields to render during onboarding.
- **Admin org resolution**: Admin pages (roster, role management) resolve the org slug to its UUID via `resolveOrganizationIdAdmin()` in `lib/features/authentication/organization-utils.ts`. This calls `GET /auth/admin/resolve-organization` on Backend-Service instead of the fragile `getFullOrganization` SDK method. The result is cached for the page session.
- **Roster search and filtering**: The admin roster fetches every non-anonymous account once (`getRoster` in `lib/features/admin/api.ts`) and applies search, role filtering, ordering and pagination in the browser (`lib/features/admin/roster-filter.ts`). This is forced by the upstream endpoint: better-auth's `admin/list-users` searches one field out of `email | name`, ANDs it with a single filter field, and never joins `auth_member` — so it can express neither "any of the four text columns" nor a station-role filter. Anonymous users stay excluded server-side (there are more of them than real accounts), and the fetch passes `sortBy` because `list-users` otherwise issues no `ORDER BY`, which makes two offsets into one result set unstable.
