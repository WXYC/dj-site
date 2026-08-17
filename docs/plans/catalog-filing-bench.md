# Catalog Filing Bench

Filing one new record into rotation currently spans two pages, three forms, and a catalog search in the middle: add the artist on the Card Catalog page, add the release in a modal, search for the release you just typed in, open its album panel, pick a bin. This plan collapses that into one form at `/dashboard/admin/catalog/file` where the artist can be created inline and the rotation bin set in the same submit.

## Decisions taken

| Question | Decision |
|---|---|
| Where the form lives | Its own sub-route, `/dashboard/admin/catalog/file`, modern slot, linked from Catalog Admin. Not a modal: a partial failure leaves rows already written, and the recovery state has to survive a refresh. |
| The two existing add panels | `ArtistAddPanel` and `AddReleasePanel` stay on the Card Catalog page for now. They are deleted in a follow-up once the bench has prod time — and not before the Various Artists gap below is closed. |
| Binning an already-catalogued release | Out of scope. The bench files new arrivals. Binning an existing release stays in the album detail panel, where it works today. |
| Conflict with the documented classic route | The bench supersedes `/dashboard/rotation/new`. `docs/architecture.md` is amended rather than followed — see below. |
| Discoverability while incomplete | The Catalog Admin entry-point button is gated behind `NEXT_PUBLIC_CATALOG_FILING_BENCH_ENABLED`, default OFF. The route itself stays reachable and server-gated regardless — the flag controls discoverability, not authority. |

### Why the entry point is flagged

`lib/features/catalog/flags.ts` already gates the half-built classic librarian nav behind `NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED`, and its rationale transfers almost word for word: every push to `main` deploys, the surface lands across several releases, and "leaving it OFF keeps a half-built menu out of a working librarian's way until the whole set is present." The bench ships knowingly incomplete — compilations are routed back to the old modal — and co-exists with two live panels that do the same job. A working MD should not meet a third path to the same task, discover it does not handle Various Artists, and lose confidence in all three.

Add `isCatalogFilingBenchEnabled()` beside the two existing helpers in that module, matching their `"true" | "1"` parsing and their render-time-not-module-init caveat (values are inlined at build time). Document it in `docs/env-vars.md`'s feature-flag catalog in PR 3. Flip it on once PR 4 closes the Various Artists gap and deletes the panels it replaces.

### Superseding the documented classic route

`docs/architecture.md` (the Librarian screens table) assigns "Add rotation release" to `/dashboard/rotation/new` in the **classic** slot, as a reproduction of `rotationReleaseInsert.jsp`, and argues against nesting librarian work under `/dashboard/admin/catalog` because it "would collide confusingly with the unrelated modern `/dashboard/admin/catalog` (format + genre admin)". That reasoning was sound when `/dashboard/admin/catalog` was only taxonomy admin. This plan changes that premise: the route becomes the MD's catalog-write home, and the bench is its first real screen.

PR 3 therefore amends `docs/architecture.md`:

- Mark the `/dashboard/rotation/new` row **superseded by `/dashboard/admin/catalog/file`**, with a one-line note that the modern bench replaced the classic JSP reproduction and why.
- Leave `/dashboard/rotation`, `/dashboard/rotation/[id]`, and `/dashboard/rotation/[id]/import` in the table. The bench covers none of them — it is not a list, not an editor, and not an importer.
- Restate the naming rationale so it reflects the new premise instead of contradicting it.
- Add a row to the "Existing dual-slot URLs" table: `/dashboard/admin/catalog/file` | `ExperienceGap` | File a release | MD.

**Pre-existing bug, not caused by this work:** `src/components/experiences/classic/Navigation.tsx:49` links to `/dashboard/rotation`, and no page owns that URL in either slot — it 404s today. Superseding the `new` row does not fix that link, and it should not be quietly folded into this chain. Worth its own ticket.

## Dependency: rotation-first filing does not survive the cutover

The legacy screens are **rotation-first** — a promo arrives, gets a `ROTATION_RELEASE` row immediately, and is *imported* into the library later, which is why `rotationReleaseImport.jsp` exists as its own screen. The bench is **library-first**: create the album, then bin it.

Rotation-first is not expressible against Backend-Service today. `addRotation` 400s when `album_id` is undefined, and `pickAddRotationFields` allowlists the body to `album_id` and `rotation_bin`, so the public API cannot create an unlinked rotation row. Rows with a null `album_id` do exist — `RotationClassifyControl` guards for them explicitly — but only the tubafrenzy webhook path can create one, and that path goes dark at the end of the month.

**The ticket already exists: [WXYC/Backend-Service#2109](https://github.com/WXYC/Backend-Service/issues/2109)** — "Support uncatalogued rotation releases: relax album_id, list the queue, link after cataloging". Open, `effort:m` / `sev:med`, approach decided 2026-08-14: relax `addRotation` to accept the free-text trio without an `album_id`, add `GET /library/rotation/uncatalogued` as its own route (the existing read's `DISTINCT ON` collapse would silently hide duplicate physical promos from a cataloguing queue), and add a link `PATCH` that sets `album_id` and clears the snapshot columns in the same transaction. No migration — `rotation.album_id` is already nullable with free-text `artist_name` / `album_title` / `record_label` beside it.

### What #2109's numbers say about this bench

Measured on prod tubafrenzy 2026-08-11, in that ticket:

| | |
|---|---:|
| Rotation releases added in the last 365 days | 313 |
| …later catalogued (went through Import) | 107 |
| …**still uncatalogued** | **206** |
| Backend `rotation` rows with no linked album | 3,837 (164 active) |

**Two thirds of what goes into rotation is never catalogued at all.** The station's real intake is rotation-first: a promo arrives, the MD bins it that week, and cataloguing happens later or never. This bench is library-first — create the album, then bin it — so it serves the ~107/year path and cannot express the ~206/year one.

That is not a reason to change course. Library-first is the only shape expressible against today's API, it is a genuine workflow (a new arrival worth cataloguing *and* binning in one pass), and it is a strict improvement on the four-stop trip it replaces. But it does mean:

- **The bench is not a replacement for the legacy rotation intake screen**, and should not be described as one. Until #2109 lands, `/wxycdb` is the only place the majority path exists — which makes #2109 a cutover risk, not a nice-to-have.
- **Step 3's body contract in this plan expires when #2109 lands.** "Exactly `{ album_id, rotation_bin }`, allowlisted server-side" is true today and will be widened. Write `fileRelease.ts` so a third rotation-create shape is an added branch rather than a rewrite.
- **A follow-on "bin it now, catalogue it later" mode is the natural next screen**, and it is the one that matches how the station actually works. Worth sequencing deliberately rather than discovering after the bench ships.

**Two process gaps found while checking this** — neither caused by this work, both worth fixing:

- **#2109 and [#2113](https://github.com/WXYC/Backend-Service/issues/2113) are on no project board.** Both carry the `tubafrenzy` label, both gate workflows that die at the 8/31 cutover, and neither appears among the 77 items on the [Tubafrenzy decommissioning board](https://github.com/orgs/WXYC/projects/36). A cutover dependency tracked only by a label is a dependency nobody is watching.
- **#2113** — "Rotation releases cannot be edited: no field-level update endpoint" — is the backend half of the re-bin gap this plan defers. It also records that the allowlist comment quoted above is *already* stale: wiki#88 Phase 3 flipped `rotation` to Backend-canonical, so "tubafrenzy is the only legitimate source for the snapshot columns" no longer holds, and every rotation release created since is uneditable. A typo in an artist name is unfixable today.

For context on what this bench builds on: the [MD catalog-edit UI epic](https://github.com/WXYC/dj-site/issues/1071) and all nine of its children are **closed** — that work shipped 2026-08-05 and is what PR 4 later deletes. This chain is its successor, not a duplicate of open work.

## Related, but not part of this chain

[Rotation records hide their call number in catalog search](rotation-hides-call-number.md) — a display change in catalog search with no overlap with the bench's write path. Same subject, separate plan, separate branch (`fix/rotation-hides-call-number`), ships in any order relative to these PRs. It also carries a live bug fix: `ReleaseChips` renders a meaningless "N" pill for rotation rows whose stored bin is the non-bin sentinel `'N'`.

## Deferred, and why it is safe to defer

- **Re-binning.** Moving Heavy to Medium is still kill-then-add, and an unkilled prior entry legitimately surfaces as two active rows. The bench only ever writes a first bin for a brand-new release, so it cannot produce that state and does not need to resolve it.
- **The rotation surfaces the legacy admin still owns** — tallysheet, weekly summary, printed rotation list, and the list/modify/import screens above. None of them are part of filing a record.
- **Various Artists per-track credits.** Covered under "Known gap" below. This is the one deferral with a hard dependency attached.

## Route and placement

New file: `app/dashboard/@modern/admin/catalog/file/page.tsx`.

Server component, matching the shape of `app/dashboard/@modern/admin/catalog/page.tsx`:

```tsx
const session = await requireAuth();
await requireRole(session, Authorization.MD);
```

`export const metadata` via `getPageTitle("File a Release")`. `PageHeader title="File a Release"`. The page owns a scroll container (`flex: 1; minHeight: 0; overflow: auto`) for the same reason the sibling catalog admin page does — `Main` is a fixed `100dvh` box with `overflow: hidden`, and the form is tall enough that its submit button would otherwise be clipped rather than scrolled to.

This is a modern-only URL, so the **classic** slot is what must cover it: `app/dashboard/@classic/default.tsx` renders `ExperienceGap` for every `/dashboard` URL the classic slot has no page for, and because that lives in `default.tsx` rather than per-route stubs, the new route is covered with no classic file. (The modern slot's own `default.tsx` covers the opposite direction — classic-only routes — and is not what makes this work.)

`e2e/tests/rbac/role-access.spec.ts` already asserts the classic gap at `/dashboard/admin/catalog`. Add a sibling assertion for `/dashboard/admin/catalog/file` in PR 3: it is a new modern-only URL, the gap is user-visible behavior, and the existing spec's comment explicitly anticipates upcoming MD-gated librarian screens.

**Entry points.** A `Button` on the Catalog Admin page linking here, above `FormatAdmin`. No new Leftbar entry: the left rail is at capacity and Catalog Admin is the natural parent. The route stays deep-linkable regardless.

**That decision orphans the rail's active state, so PR 3 fixes it.** `LeftbarLink` selects its variant on exact equality (`pathname === props.path`), so at `/dashboard/admin/catalog/file` *no* rail item renders active — not even the parent — which reads as having navigated out of the app. Widen that test to a path-prefix match: `pathname === path || pathname.startsWith(path + "/")`, which is character-for-character what classic `Navigation.tsx` already uses. The parent Catalog Admin item then highlights for its whole subtree. No existing modern route is nested under another, so no current link changes behavior — this is additive today and correct for every sub-route added later.

The form component lives at `src/components/experiences/modern/admin/catalog/FileReleaseForm.tsx`, wrapped in `RequireMD`. To be precise about what that buys: `RequireMD` **hides the affordance**; the `requireRole` call in the page component **is** the gate. `docs/architecture.md` states this explicitly — `AuthorizedView` / `RequireMD` is a client component and is never the authority — and this plan does not change it.

## The form

One card, fields in this order. Every field is `disabled` while any write is in flight.

| # | Field | Control | Notes |
|---|---|---|---|
| 1 | Genre | `Select` from `useGetGenresQuery` | Required, and leads. Artist rows are genre-scoped, so nothing below resolves until it is set. A change retracts the picked artist id and marks the dedup check stale. Guarded by `isGenresUnavailable` with its retry affordance. |
| 2 | Artist | `ArtistSearchTypeahead` | Required. Disabled until a genre is chosen (placeholder: "Choose a genre first"). `onSelect` holds the artist id and closes the disclosure; `onCreateNew` clears the id and opens it; `onSelectionCleared` drops the id. |
| 3 | New artist | `NewArtistFields` (extracted — see PR 1) | Rendered only when the typeahead reported "create new". Call letters, code number, alphabetical name, next-code preview, conflict banner. |
| 4 | Album title | `Input` | Required. |
| 5 | Label | `LabelSearchTypeahead` | Required. Holds `label_id` when a row is picked; free text creates a label server-side. |
| 6 | Format | `Select` from `useGetFormatsQuery` | Required. **Guarded by `isGenresUnavailable` too** — see below. |
| 7 | Rotation | `RotationBinSelector` + a "Catalog only" checkbox | Optional by design. Most records the station files never enter rotation. |

Both lookup queries run unconditionally here. The modal skips them until it opens because most catalog page loads never open it; this page exists only to be filled in.

**Formats get the same outage guard as genres.** `isGenresUnavailable` is already generic over `{ isUninitialized, isLoading, data?: readonly unknown[] | null }` and takes the formats query unchanged. Without it, a formats outage renders an empty required `Select` beside a permanently disabled submit with no explanation — precisely the misreading that module's doc comment exists to prevent. Add a line to that doc noting it is generic over any required lookup list; do not rename it, which would churn three unrelated classic and modern consumers for no behavioral gain.

**"Catalog only" is a checkbox, not a fifth radio.** `RotationBinSelector` types `onSelectBin: (bin: Rotation) => void` with no null, so once a bin is clicked there is no way back to "no bin" — and it renders its own `role="radiogroup"`, so a sibling radio outside that group would be a lie to assistive tech. The bench renders a `Checkbox` ("Catalog only — not going into rotation") beside the selector: checking it clears `selectedBin` and disables the selector. This needs no change to the shared component, and leaves its two existing consumers (`RotationClassifyControl`, `RotationEntryFields`) and its test untouched.

Submit is enabled when: album title, genre, format, artist (id or text), and label are all present; the new-artist fields validate if the disclosure is open; no unresolved artist conflict stands; neither lookup list is unavailable; and nothing is in flight.

Below the button, a live count of what the submit will write — "Writes 3 records" / "Writes 2 records". It is not decoration: it is what makes the partial-failure states below legible when they happen.

## The orchestrator

The three writes are the substance of this feature, and they do not belong inside a component. They go in `lib/features/catalog/fileRelease.ts` as a pure module with the mutation callers injected, so the whole failure matrix is unit-testable without React.

```ts
export type FileReleaseInput = {
  genreId: number;
  formatId: number;
  albumTitle: string;
  labelName: string;
  labelId: number | null;
  artistName: string;
  artistId: number | null;          // non-null when the typeahead resolved one
  newArtist: NewArtistInput | null; // non-null when the disclosure is open
  rotationBin: RotationBin | null;  // null = catalog only
};

/** What this run has already committed. Carried across retries. */
export type FiledSoFar = {
  artistId: number | null;
  artistCreatedHere: boolean;
  libraryId: number | null;
  rotationId: number | null;
  /** Latches when a release write's outcome is unknowable — see below. */
  unverifiedWrite: "release" | null;
};

export type FileReleaseResult =
  | { status: "filed"; filed: FiledSoFar; assignedCode: string | null }
  | { status: "stopped"; filed: FiledSoFar; failedAt: "artist" | "release" | "rotation"; error: unknown };
```

`assignedCode` is non-null only when **this run** created the artist, so on the common path — the typeahead resolved someone already filed — it is `null` and the success confirmation has no code to name from the result alone. The form supplies it instead: `ArtistInGenreOption` already carries `code_letters` and `code_number`, so the form holds the picked artist's code beside its id and renders the confirmation from whichever source has one. Do not widen `FileReleaseInput` to carry the code — the orchestrator has no use for it, and threading a display-only value through a write path invites someone to start writing it.

`runFileRelease(input, filed, deps)` walks the three steps, skipping any whose artifact in `filed` is already non-null, and returns on the first rejection with everything committed up to that point. It never throws.

Step contracts:

1. **`POST /library/artists`** — only when `filed.artistId === null` and `input.newArtist !== null`. Body is `AddArtistRequestBody`; `alphabetical_name` is omitted when blank rather than sent empty. On success, sets `artistId` from the response and `artistCreatedHere: true`. The assigned code comes from the response body, not from what was typed — the two agree today, but only the server's copy is what was filed.
2. **`POST /library`** — always, when `filed.libraryId === null`. Body is `AddAlbumRequestBody`. `artist_id` is sent whenever one is known (from step 1 or the typeahead) because only the id skips the genre-scoped name resolution that can 400. `artist_name` rides along **even when the id is present** — it is the sole artist input to the backend's post-insert metadata enrichment, and omitting it loses the artwork and collides the enrichment cache key across every release sharing an album title. `album_artist` and `code_number` are never sent: the backend silently drops the first and assigns the second.
3. **`POST /library/rotation`** — only when `input.rotationBin !== null` and `filed.rotationId === null`. Body is exactly `{ album_id, rotation_bin }`; the backend allowlists it to those two fields and derives everything else.

Step 3's `album_id` comes from step 2's response `.id`. When that is not a number, rotation cannot be filed and the run stops at `failedAt: "rotation"` with an explicit error — not a silent success. The release is real and in the catalog; saying nothing would read as "this record needed no bin".

### Cache obligations

- `addAlbum` and `addArtist` already invalidate `CatalogList / LIST`; nothing to add.
- `addRotationEntry`'s own `onQueryStarted` already runs `patchCatalogSearchRotation`; nothing to add.
- **The one thing the caller owes:** when `labelId === null`, dispatch `labelsApi.util.invalidateTags([{ type: "LabelSearch", id: "LIST" }])` after step 2 succeeds. A free-typed label was just upserted server-side, `searchLabels` only reads, and nothing else invalidates it — without this, reopening the picker inside the 60s cache window offers to create the near-duplicate the field exists to prevent. This runs unconditionally on success, regardless of what the form is showing by the time the response lands.

## Partial failure

There is no transaction across the three writes. Each can succeed while a later one fails, and none roll back. On a stop, the form does not stay a form — it switches to a **recovery state**: every field goes read-only (they describe rows that already exist), a status list renders what landed, and exactly one primary button retries only the missing step.

| Stop | In the database | Form says | Primary button |
|---|---|---|---|
| Artist 409 | Nothing | Names the artist holding the code or the name, inline. Fields stay **editable** — this is a correction, not a recovery state. | Unchanged ("File release") |
| Artist fails otherwise | Nothing | "Nothing was filed." | "Try again" — replays all steps |
| Release fails, `artistCreatedHere: true` | Artist exists, album-less | "{Name} was added to the catalog as {CODE}. The release wasn't filed — trying again won't create the artist twice." | "File the release" — skips step 1 |
| Release fails, `artistCreatedHere: false` | Nothing — step 1 was skipped | "Nothing was filed." No code exists to name. | "Try again" |
| Rotation fails | Artist and release filed | "{Title} is in the catalog. It isn't in rotation yet." | "Add to rotation" — skips steps 1 and 2 |
| All land | Everything | Confirms with the assigned code and the bin | "File another record" — resets the form |

The two release-fail rows are the reason `artistCreatedHere` exists on `FiledSoFar`. A single row would assert a write that did not happen whenever the typeahead resolved an existing artist — which is the common case, not the edge one. Both rows get their own integration test.

The artist 409 case reuses the existing conflict handling wholesale: `isConflictRejection`, `isAddArtistConflict`, `isArtistNameConflictData`, and the rule that a code-triple edit clears a code conflict but leaves a name conflict standing. That distinction exists because a name conflict is not fixed by adjusting the code, and re-enabling submit would steer the librarian into re-submitting something that can only 409 again.

The primary button must never read "File release" once `libraryId !== null`. That relabel is the whole guard against double-filing, and it is worth an explicit test.

### The one case we cannot retry

If step 2 fails in a way that leaves the outcome unknowable, the request may have committed and lost its response. A blind retry duplicates the release, and nothing client-side can tell the two apart.

**Classification** — latch `unverifiedWrite: "release"` when:

```ts
typeof error?.status !== "number" || error.status >= 500
```

That covers the string statuses `FETCH_ERROR`, `TIMEOUT_ERROR`, and `PARSING_ERROR` (a dropped connection, a timeout, a gateway's HTML error page), a `SerializedError` with no status at all, and any 5xx — a server that failed *after* its INSERT looks identical from here to one that failed before. A 4xx is excluded: the server refused the body before writing, so retrying after a correction is safe.

**Do not use `isUnmessagedHttpError` for this.** It delegates to `friendlyMiddlewareMessage`, which returns a message for `FETCH_ERROR`, `TIMEOUT_ERROR`, and `PARSING_ERROR` — so it is **false** for exactly the transport failures this latch exists to catch, and **true** for a bodyless 500. It answers "did the middleware stay quiet?", which is a different question, and remains the right predicate for deciding whether the component owes its own toast.

In the latched state, offer no retry at all. Say: *"The release may or may not have been filed. Search the catalog for '{title}' before trying again."* with a link to catalog search pre-filled.

The precedent is `VaTracklistStep`'s `attempted` latch, for the same underlying reason — a request that commits and then fails to deliver its response leaves rows behind that only a read can discover — though note it latches on *any* rejection, unclassified. The finer classification here is deliberate: the bench's step 2 has a common, genuinely-safe-to-retry 4xx (a blank title, a genre-scoped artist miss) that the VA step does not.

## Known gap: Various Artists

`AddReleasePanel` detects a compilation artist name via `isCompilationReleaseArtistName` and hands off to `VaTracklistStep` — the only place in the product that can supply per-track credits for a release.

For v1 the bench does **not** carry that step. When the artist name matches the compilation predicate, the bench shows an inline note before submit: *"Compilations need their per-track artists added from Add Release on the Card Catalog page."* — which is honest, because that panel still exists under the coexistence decision above.

**This makes the deletion follow-up strictly dependent on moving `VaTracklistStep` into the bench first.** Deleting `AddReleasePanel` while the bench still points at it would leave compilations with no entry point for credits that have no other source. Note it on the follow-up ticket as a blocker, not a nice-to-have.

## Work breakdown

Four PRs, chained. Each is independently reviewable and lands green.

### PR 1 — Extract the shared artist-creation pieces

Pure refactor, no behavior change. `ArtistAddForm` today owns two things the bench needs verbatim, and they come out separately because they have different shapes:

**`src/components/shared/inputs/NewArtistFields.tsx`** — the presentational field group: call letters with uppercase normalization and caret preservation, code number with its column-range ceiling, alphabetical name, `CallLetterPeekControl` wiring, and the conflict banner. Fully controlled; owns no submit and no mutation.

**`useArtistDedupCheck`, added to `src/hooks/catalogHooks.ts`** — the dedup state machine: `existingArtist`, `dedupCheckStale`, and the handlers that clear or mark them. This is deliberately *not* inside `NewArtistFields`. It is driven by the genre `Select` and `ArtistSearchTypeahead`, both of which sit **outside** the extracted field group (they are fields 1 and 2 of the bench, and the typeahead is what decides whether field 3 renders at all). Extracting it as a hook is what lets both forms share the logic without either surrendering ownership of the typeahead.

It goes in `src/hooks/` rather than `lib/features/catalog/` because that is where this repo keeps React hooks — `lib/` holds no `use*` module other than `lib/hooks.ts` (the typed Redux hooks), and `docs/architecture.md` documents `lib/features/*` as `types.ts` / `frontend.ts` / `api.ts` / `conversions.ts` plus pure helpers. `fileRelease.ts` in PR 2 stays in `lib/features/catalog/` for that same reason, being a pure module in the mould of `genreAvailability.ts` and `patchSearchCaches.ts`.

What stays behind in `ArtistAddForm`: its genre `Select` and outage alert, the typeahead and its helper text, `canSubmit`, the `conflict` / `added` state, and the `addArtist` call. It gets meaningfully thinner, but "thin wrapper" would overstate it.

Carry across intact, because each is a bug someone already paid for:

- The uppercase normalization and its `useLayoutEffect` caret restore. Writing normalized text back into a controlled input drops the caret at the end; an MD correcting a character mid-code silently files a different but valid-looking code. Codes go on physical cards, so wrong-but-valid is the expensive outcome.
- The permissiveness of the call-letter field. `V/A`, `??`, and codes carrying digits are all real filed codes — narrowing to A–Z would make those releases impossible to file. Only case is normalized.
- The dedup-stale rules, including that a whitespace-only edit does **not** clear the flag, and that reopening the typeahead panel re-runs the search without reporting back and so must not clear it either.
- The column ceilings (`varchar(4)`, `varchar(128)`, `int4`), which nothing between the field and the INSERT checks.

Existing `ArtistAddForm` tests must pass **unedited**. That is the acceptance criterion: if they need edits, the refactor changed behavior and should be reconsidered.

New tests, at the paths the repo's mirroring convention dictates:

- `tests/integration/components/shared/inputs/NewArtistFields.test.tsx` — an **integration** test, not a unit test: it is a component, so it renders through `renderWithProviders`, and there is no `tests/unit/components/` directory to put it in. The sibling directory already exists (`ArtistSearchTypeahead.test.tsx` lives there).
- `tests/unit/hooks/useArtistDedupCheck.test.tsx` — its own file, matching the sibling hooks exported from `catalogHooks.ts` (`useCatalogQueryResults.test.tsx`, `useMissingReleases.test.tsx`, `useCatalogFlowsheetSearch.test.tsx`). Do **not** extend `catalogHooks.test.ts`: it is a `.ts` file covering only the pure helpers `dedupeAlbumEntriesById` / `buildCatalogQuery` / `toLibraryQueryParams`, and a hook needs `.tsx`.

**Worth deciding in review, not here:** `src/components/experiences/classic/catalog/NewArtistForm.tsx` and `CreateLibraryCodeForm.tsx` duplicate this same field group and 409 policy, and already share `validateNewArtistNames` from `lib/features/catalog/chooserValidation.ts`. Landing `NewArtistFields` in `src/components/shared/inputs/` puts it in reach of both. Converting them is explicitly **not** in this PR — classic and modern have different field chrome, and a four-consumer refactor is not the place to start — but note it so the question is asked deliberately rather than discovered later.

*Estimate: net ≈ 0 in `ArtistAddForm` — the diff is dominated by moved lines — plus ~150 lines of new tests across the two paths above.*

### PR 2 — `fileRelease` orchestrator

`lib/features/catalog/fileRelease.ts` plus `tests/unit/lib/features/catalog/fileRelease.test.ts`. No UI, no React. Deps injected as plain async functions so the tests drive them directly.

Cases to cover, parameterized where they share shape:

- All three steps succeed; two steps (existing artist); two steps (catalog only); one step (existing artist, catalog only).
- Each step failing in turn, asserting the returned `filed` names exactly what landed — including that a step-2 failure with a pre-existing artist reports `artistCreatedHere: false`.
- Retry from each stop skips the completed steps and issues only the remaining calls.
- Step 2 returning a non-numeric `id` stops at `rotation` rather than posting a malformed body.
- **Latch classification, one case each:** `FETCH_ERROR` latches; `TIMEOUT_ERROR` latches; `PARSING_ERROR` latches; a statusless `SerializedError` latches; a 500 latches; a 400 does **not**; a 409 does **not**.
- `artist_name` is present in the step 2 body even when `artist_id` is set.

**The latched state is enforced by the form, not the orchestrator.** `FileReleaseResult` has no status meaning "refused to start", so a refusal returned from `runFileRelease` would surface as `{status: "stopped", failedAt: "release"}` with a synthetic error — indistinguishable from a real step-2 rejection, and a worse lie than not modelling it. The component owns the refusal, which is where the "may or may not have been filed" copy already lives: it reads `filed.unverifiedWrite` and renders the dead-end state instead of calling the orchestrator at all.

**Not tested:** that `album_artist` and `code_number` never appear in the step 2 body. `AddAlbumRequestBody` declares neither, so TypeScript already forbids them and the assertion could only fire behind a cast — it would test the type system, not the code. What is load-bearing is the *reason* (the backend silently drops one and assigns the other), so carry that comment into `fileRelease.ts` where the body is built. The comment is the artifact; the test would be theatre.

*Estimate: ~400 lines including tests.*

### PR 3 — The route and the form

The page, `FileReleaseForm`, the Catalog Admin entry-point button, the `LeftbarLink` prefix-match widening, the `docs/architecture.md` amendments, the `docs/env-vars.md` flag entry, and the e2e classic-gap assertion.

Three test files, mirroring what the sibling page already carries:

- `tests/integration/app/dashboard/@modern/admin/catalog/file/page.test.tsx` — the `requireRole(MD)` gate, asserting the `NEXT_REDIRECT` marker so that "reached" means "actually rendered" rather than "did not throw". Fold the `flex: 1 / minHeight: 0 / overflow: auto` scroll-container assertion in here, or add a `.scroll` counterpart; the sibling splits them, and either shape is fine so long as the container is pinned. Without this the page's own gate ships untested, which is the one thing on this route that is a security property rather than an ergonomic one.
- `tests/integration/components/modern/Leftbar/LeftbarLink.test.tsx` — extend with a prefix-match case and a near-miss. The existing cases pin exact-match behavior but both keep passing under the widened rule (the negative case uses `/dashboard/other`, not a prefix), so nothing in the suite would catch either a regression of the subtree highlight or a `/dashboard/adminX` false positive.
- `tests/integration/components/modern/admin/catalog/FileReleaseForm.test.tsx` — the form itself, rendered through `renderWithProviders` with MSW fakes, never bare RTL.

Form cases:

- Genre-first gating: the artist field is disabled with the "choose a genre first" placeholder until a genre is set.
- Picking an existing artist keeps the new-artist disclosure closed and files two records.
- "Create new" opens the disclosure, and the next-code preview renders.
- A genre change after an artist is picked retracts the id and surfaces the stale-recheck helper.
- The "Catalog only" checkbox clears a chosen bin, disables the selector, and drops the rotation write.
- A formats outage renders the alert and its retry, not an empty `Select`.
- Each recovery state renders its copy and its single correct button, and that button issues only the remaining request — **both** release-fail rows included.
- The latched unverified-write state offers no retry and links to catalog search.
- The primary button never reads "File release" once a release id is held.
- Compilation artist names surface the Various Artists note.
- Non-MD renders nothing.

Test data uses real WXYC catalog entries per the repo convention — Nilüfer Yanya on Ninja Tune, Chuquimamani-Condori, Jessica Pratt — not mainstream acts. The diacritics in "Nilüfer Yanya" are load-bearing for the alphabetical-name field.

*Estimate: ~650 lines including tests and docs.*

### PR 4 — Follow-up, after prod validation

Move `VaTracklistStep` into the bench (**blocker**), then delete `ArtistAddPanel` and `AddReleasePanel`, their tests, and their buttons from the Card Catalog header. Verify with fresh greps before deleting rather than trusting this document, which will be stale by then.

## Risks

- **The bench and the modal disagree.** For as long as both exist, two forms write releases through different code paths. PR 2's orchestrator is the mitigation — the bench's behavior is pinned by unit tests that do not depend on the UI, so drift shows up as a test failure rather than a field the modal validates and the bench does not.
- **The extraction in PR 1 regresses the caret or the dedup-stale handling.** Both are subtle, both were bugs before. The unedited-tests criterion is the guard.
- **The recovery state is written but never exercised.** Partial failure is rare in normal operation, which is exactly why it rots. The integration tests drive every state explicitly, and they are the only reason to trust the copy.
- **The 4xx-is-safe assumption in the latch.** A 4xx from an intermediary rather than the application would be classified as safe-to-retry when it is not. Judged acceptable: the backend's own 4xx paths validate before writing, and treating every failure as unverifiable would make the common blank-field mistake unrecoverable without a catalog search.
- **Timeline.** The legacy catalog admin goes dark at the end of the month. This chain does not block that — the bench is an ergonomics win over paths that already exist on Backend-Service — but PR 4's deletion should not be rushed to land before the date at the cost of the Various Artists blocker, and the rotation-first dependency above is the one item that genuinely does have a deadline.
