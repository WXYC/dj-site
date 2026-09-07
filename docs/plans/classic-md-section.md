# Classic Music Department section

## Problem

Classic has the librarian screens but no MD *section*. Slices 0–6a of WXYC/dj-site#1163 landed `/dashboard/library/**` and `/dashboard/rotation/**` in the `@classic` slot, and `NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED` is `true` in production and preview — so a music director does see links today. What he sees is three flat entries wedged into the DJ nav bar (`Add/Modify Catalog`, `Missing Releases`, `Rotation`) with no grouping, no landing page, and no name for the thing they belong to.

`/wxycdb` did have that grouping, in two files this plan xeroxes:

- `jsp/rotation/musicmenu.jsp` — `<title>WXYC Music Department application</title>`, `<body class="library-admin">`, three `<h3>` links: Format Tallysheets, Rotation Releases, Add Rotation Releases.
- `jsp/libraryAdmin/libraryAdminLinks.jsp` — a "Search for Artists & Releases:" form (`size=60` input, `Search!` / `Clear Box` buttons) over two `<h3>` links: Create or Find Artists By Library Code, Missing Releases.

Under epic #1163's binding design rule — *"Treat the JSPs as the design spec, not as legacy to be improved on… navigation structure and terminology match `/wxycdb`"* — a Music Department menu page is not an invention. It is a screen the xerox is currently missing.

## Decision

Add `/dashboard/md`, a classic-only Music Department menu that merges the two JSPs above, and collapse the one MD-only nav entry into a single MD-gated `Music Department` link pointing at it.

### Nav bar, before and after

Today, with the flag on:

| Role | Bar |
|---|---|
| DJ | Card Catalog, Flowsheet, Previous Sets *(disabled)*, Missing Releases, Rotation, Log Out |
| MD | …the same, plus Add/Modify Catalog |

After:

| Role | Bar |
|---|---|
| DJ | Card Catalog, Flowsheet, Previous Sets *(disabled)*, Missing Releases, Rotation, Log Out — **unchanged** |
| MD | …the same, plus **Music Department** |

`Add/Modify Catalog` leaves the bar. It is the only MD-gated entry there, and its label was invented by dj-site — on the menu page it is restored to the JSP's own wording, `Create or Find Artists By Library Code`.

The cost is confined to **cold entry**: `/dashboard/library` already carries six other inbound links, all reading `Find and Create an Artist and/or Library Code`, from `catalog/ArtistCard.tsx:256`, `catalog/VariousArtistsCard.tsx:224`, `catalog/ReleaseCard.tsx:157`, `catalog/ReleaseMoveForm.tsx:293`, `catalog/ReleaseDeleteConfirm.tsx:205`, and `catalog/ReleaseTracklistEditor.tsx:345`. A librarian already inside the card screens is unaffected; only one arriving fresh at the dashboard pays the extra click, and the `Music Department` entry sits in the bar slot the old link occupied.

**`Missing Releases` and `Rotation` stay in the bar for every role.** This is the one deliberate deviation from the shape sketched when this was scoped, and it is not optional: `mainmenu.jsp` places both outside its `hasAdminAccess()` block, Backend gates `GET /library/rotation` and `PATCH /library/:id/missing|found` at `catalog: ['read']`, and #1163 records the standing instruction that Mark Missing / Mark Found must never be MD-gated (PR #1082 was closed as a regression for exactly that). Folding them behind an MD-gated entry would delete a plain DJ's only inbound link to both screens. They appear in *both* places for an MD, matching `/wxycdb`, where Missing Releases is reachable from the main menu and from `libraryAdminLinks.jsp`.

### Screen

`/dashboard/md`, rendered through `classic/Layout/Main` like every other classic screen, so it carries the nav bar.

| Entry | Source JSP | Destination |
|---|---|---|
| "Search for Artists & Releases:" form | `libraryAdminLinks.jsp` | `/dashboard/catalog?searchString=…` |
| Create or Find Artists By Library Code | `libraryAdminLinks.jsp` | `/dashboard/library` |
| Missing Releases | `libraryAdminLinks.jsp` | `/dashboard/library/missing` |
| Rotation Releases | `musicmenu.jsp` | `/dashboard/rotation` |
| Add Rotation Releases | `musicmenu.jsp` | `/dashboard/rotation/new` |

Link markup is `<h3>` per both JSPs, not the nav bar's list styling. The heading reads "WXYC Music Department application", from `musicmenu.jsp`'s `<title>`.

### Nav active-highlight

`Navigation.tsx:52-55` marks a link active on `pathname === path || pathname.startsWith(path + "/")`, evaluated per link with no tie-break. Two consequences, one new and one pre-existing:

- **New:** `Music Department` (`/dashboard/md`) would not match any `/dashboard/library/**` URL, so an MD editing a release would see no active bar entry at all.
- **Pre-existing bug:** on `/dashboard/library/missing`, *both* `Add/Modify Catalog` (prefix match) and `Missing Releases` (exact match) are active today, so two entries render highlighted at once.

Both are fixed by one change: `NavLink` gains an optional `activePrefixes`, `Music Department` claims `/dashboard/library`, and `isActive` resolves to the **longest** matching path across all rendered links rather than every match independently. `/dashboard/library/missing` then highlights `Missing Releases` only; `/dashboard/library/release/12` highlights `Music Department`; `/dashboard/rotation/new` highlights `Rotation`. `Music Department` deliberately does **not** claim `/dashboard/rotation`, which `Rotation` already owns.

### Authority

Page gate is server-side, matching `/dashboard/library`:

```ts
const session = await requireAuth();
await requireRole(session, Authorization.MD);
```

The nav entry is wrapped in `AuthorizedView requiredRole={Authorization.MD}`, cosmetic only — the page gate is what protects the screen. Two of the five destinations are DJ-accessible on their own pages; gating the *menu* at MD does not tighten them, because the bar still reaches both directly.

MD, not SM: every destination is a catalog surface, and `/dashboard/library` is already MD.

### Flag

Rides the existing `NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED`. No new flag — this reorganizes entries already behind that gate, and #1212 owns the eventual flip. `/dashboard/md` itself stays URL-reachable and server-gated regardless, per the flag's stated contract that it controls discoverability and never authority.

## Files

**New**

- `app/dashboard/@classic/md/page.tsx` — server component, `requireAuth` + `requireRole(MD)`, `metadata.title` via `getPageTitle`.
- `src/components/experiences/classic/musicDepartment/MusicDepartmentMenu.tsx` — the menu markup. Stays a server component: `Layout/Main` is `"use client"`, but this is passed to it as `children` from a server page, so it is not pulled into the client graph. Directory is `musicDepartment/`, not `md/` — siblings are all domain words (`catalog/`, `library/`, `rotation/`) and `md/` reads as "markdown".
- `src/components/experiences/classic/musicDepartment/MusicDepartmentSearchForm.tsx` — `"use client"`, the one interactive piece.

**Modified**

- `src/components/experiences/classic/Navigation.tsx` — swap the `Add/Modify Catalog` entry for `Music Department` → `/dashboard/md`; add `activePrefixes` and longest-match `isActive`.
- `src/components/experiences/classic/rotation/RotationReleaseList.tsx` — its "Main Menu" divergence comment (lines 285-288) says *"There is no dj-site route named after the servlet path itself"*, which this plan falsifies. The link **stays** pointed at `/dashboard/catalog`: this screen is DJ-accessible and `/dashboard/md` is MD-gated, so re-pointing it would bounce a DJ off the menu it just offered him. The comment is rewritten to give that as the reason instead of the stale one.
- `docs/architecture.md` — add the `/dashboard/md` row to the librarian URL-map table, **and** amend line 105's "Naming follows `/wxycdb`'s own directory split" paragraph, which `/dashboard/md` otherwise contradicts two tables below itself. The `/dashboard/music*` and `/dashboard/admin/*` reasoning moves out of divergence #3 into that paragraph.
- `docs/env-vars.md` — line 94 needs three fixes in one pass, not just the enumerated-entries clause: name Music Department instead of card-catalog admin; drop *"the Rotation entry points at a route no page owns in either slot and 404s until WXYC/dj-site#1171 lands"*, false since `app/dashboard/@classic/rotation/page.tsx` landed; and soften *"`/dashboard/library/missing` has no inbound link anywhere in the app except this nav bar"*, which after this change has two.

## Tests

Written first, per the repo's TDD default. All under `tests/`, never colocated; rendered through `renderWithProviders`.

1. `tests/integration/app/dashboard/@classic/md/page.test.tsx` — authority, via `tests/helpers/classic-page-authority-harness.ts`: `musicDirector` and `stationManager` reach the page, `dj` is denied, unauthenticated redirects, and the admin-plugin `role` column never grants access. Parameterized over roles, matching `@classic/library/page.test.tsx:44`. `assertReachesClassicPage` requires at least one landmark testid, so the test stubs `Layout/Main` and `MusicDepartmentMenu` via `vi.mock` with testids — a real render would pull in the live better-auth client (`docs/testing.md:175-185`).
2. `tests/integration/components/classic/musicDepartment/MusicDepartmentMenu.test.tsx` — the five entries render with the JSP's labels and the destinations in the table above; asserts labels verbatim, since label drift is the failure mode #1163 names.
3. `tests/integration/components/classic/musicDepartment/MusicDepartmentSearchForm.test.tsx` — pushes `/dashboard/catalog?searchString=…` with the term trimmed; an empty or whitespace-only input navigates to `/dashboard/catalog` with no query; `Clear Box` empties the input without navigating. Mirrors the existing `classic/catalog/SearchForm.test.tsx` and `classic/playlists/SearchForm.test.tsx`.
4. `tests/integration/components/classic/Navigation.test.tsx` *(update)* — `Music Department` shown to an MD and hidden from a DJ; `Missing Releases` and `Rotation` still shown to a DJ; `Add/Modify Catalog` gone for everyone; and the active-highlight cases, including the two-entries-highlighted regression guard on `/dashboard/library/missing`. The existing "shows every librarian link to a music director" case changes shape rather than being deleted.

## Divergences from `/wxycdb`, to be enumerated in the PR

1. **Format Tallysheets is omitted.** `musicmenu.jsp`'s third entry. wiki#89 decision D5 drops the rotation tallysheet and #1163 records it as out of scope. No new decision is taken here.
2. **The search form navigates instead of submitting.** The JSP does `GET searchCardCatalog`; classic's card catalog is a live debounced search reading `searchString` from the URL, so the form pushes `/dashboard/catalog?searchString=…`. Same destination, same parameter name, existing surface. `Clear Box` clears the input, matching `<input type=reset>`.
3. **URL is `/dashboard/md`,** where the JSP was served at `/wxycdb/musicmenu`.
4. **`Missing Releases` and `Rotation` appear both in the bar and on the menu.** Reasoned above; the alternative is a DJ-visible regression.
5. **`Add Rotation Releases` (plural, JSP-verbatim) will coexist with `Add Rotation Release` (singular)** at `rotation/RotationReleaseList.tsx:332`, both linking `/dashboard/rotation/new`. Both defensible — one is the JSP's wording, one is the shipped screen's — but noted rather than silently reconciled.

## Out of scope

- Classic ports of `/dashboard/admin/catalog` (format + genre admin) and `/dashboard/admin/roster` — both keep falling through to `ExperienceGap`. Neither has a `/wxycdb` source; roster is SM-gated and ~2,600 lines of modern MUI.
- Format Tallysheets, per D5.
- Any change to the librarian screens themselves, or to modern.

## Risks

- **Cold-entry discoverability for the catalog entry point.** Bounded above to the fresh-arrival case by the six existing inbound links. Worth confirming with Bill during the #1163 validation week rather than assuming.
- **Test churn in `Navigation.test.tsx`.** The bar's MD case is asserted there today; the update is deliberate, not incidental, and the DJ-accessibility cases must survive untouched as the regression guard.
