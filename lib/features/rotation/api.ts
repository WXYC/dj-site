import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { AppDispatch, RootState } from "@/lib/store";
import { backendBaseQuery } from "../backend";
import { convertToAlbumEntry } from "../catalog/conversions";
import {
  cachedAlbumRotationId,
  patchCatalogSearchRotation,
} from "../catalog/patchSearchCaches";
import { AlbumEntry, AlbumSearchResultJSON } from "../catalog/types";
import type {
  AddRotationCardRequest,
  AddRotationRequest,
  KillRotationRequest,
  RotationCard,
  RotationEntry,
  UpdateRotationCardRequest,
} from "@wxyc/shared";
import type {
  FreeTextRotationAddRequest,
  LinkRotationArgs,
  RotationListRow,
  RotationListStatusFilter,
  RotationRowSummary,
  UpdateRotationArgs,
} from "./types";
import { DEFAULT_ROTATION_STATUS_FILTER } from "./types";
import { isRotationRowActive } from "./classicList";
import { wrapRotationWriteError } from "./writeErrorMessage";

// The facet reads -- every rotation query but the single-row one and the
// `status=all` management read. Scoped so a field-level edit can refresh them
// without invalidating the row it just echoed back to the screen that saved
// it. A bare `"Rotation"` invalidation still reaches them: a tag with no id
// matches every id of its type.
const ROTATION_LIST_TAG = { type: "Rotation", id: "LIST" } as const;
// The `status=all` management read alone. Its own id so the row writes below
// (kill, unkill, card move) can move a row by patching the cached list
// instead of invalidating it -- that read is the station's whole rotation
// history, and a full-history refetch per row action is the cost the patch
// exists to avoid. The writes whose result the client cannot construct (an
// add, a link, a snapshot edit, a release filing) still reach it: adds and
// links invalidate the bare type, which matches this id like any other.
const ROTATION_STATUS_ALL_TAG = { type: "Rotation", id: "STATUS_ALL" } as const;
const ROTATION_CARDS_LIST_TAG = { type: "RotationCards", id: "LIST" } as const;

export const rotationApi = createApi({
  reducerPath: "rotationApi",
  baseQuery: backendBaseQuery("library/rotation"),
  tagTypes: ["Rotation", "RotationCards"],
  endpoints: (builder) => ({
    // Opts out of the shared soft-JSON-failure handling
    // (`surfaceNonJsonAsError`), for the same reason as `getRotationList` and
    // `getUncataloguedRotation` below and one more besides. Every caller here
    // treats the absence of a row as the positive claim "this release is in no
    // bin": the album card renders no badge, and the catalog row's context menu
    // opens with no active entries, so a bin pick adds without retiring and
    // stacks a second active bin on a release that already had one. Reading an
    // unparseable body as an empty rotation list therefore does not merely show
    // a thin screen, it licenses a write that is wrong.
    getRotation: builder.query<AlbumEntry[], void>({
      query: () => ({
        url: "",
      }),
      extraOptions: { surfaceNonJsonAsError: true },
      // A JSON `null` body is still reachable and still means "no rows"; only
      // the unparseable case is now an error.
      transformResponse: (response: AlbumSearchResultJSON[] | null) =>
        response ? response.map(convertToAlbumEntry) : [],
      providesTags: [ROTATION_LIST_TAG],
    }),
    // Typed against the shared OpenAPI contract (album_id: number) — the old
    // local RotationParams declared album_id: string, drifting from the wire
    // and forcing casts on future callers (#627).
    addRotationEntry: builder.mutation<RotationEntry, AddRotationRequest>({
      query: (rotation) => ({
        url: "",
        method: "POST",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
      async onQueryStarted(
        { album_id, rotation_bin },
        { dispatch, getState, queryFulfilled },
      ) {
        try {
          const { data } = await queryFulfilled;
          patchCatalogSearchRotation(
            dispatch,
            getState as () => RootState,
            album_id,
            { rotation_bin, rotation_id: data.id, card: data.card ?? null },
          );
        } catch {
          // A rejected `queryFulfilled` (mutation failure or the cache patch
          // itself throwing) must not escape this handler: RTK Query treats
          // an onQueryStarted rejection as an unhandled promise rejection,
          // and the caller's own `.unwrap()` already owns surfacing the
          // failure to the user (toast). Swallowing here avoids reporting
          // the same failure twice.
        }
      },
    }),
    // `kill_date` is optional on the wire and callers leave it off: the server
    // stamps CURRENT_DATE in the database's own timezone. A date computed in
    // the browser is a UTC calendar day, which runs a day ahead of Eastern
    // evening hours, and the rotation read keeps any entry whose kill_date is
    // still in the future.
    killRotationEntry: builder.mutation<RotationEntry, KillRotationRequest>({
      query: (rotation) => ({
        url: "",
        method: "PATCH",
        body: rotation,
      }),
      // Enumerated, not the bare `"Rotation"` type: a bare-type invalidation
      // matches every id, including the `status=all` management read this
      // handler patches instead of refetching. The bounded facets and the
      // killed row's own single-row read still refetch.
      invalidatesTags: (_result, _error, { rotation_id }) => [
        ROTATION_LIST_TAG,
        { type: "Rotation", id: rotation_id },
      ],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // A kill's new date is knowable only from the response -- the
          // server stamps CURRENT_DATE in the database's own timezone (see
          // the endpoint comment above). Move the row in the cached
          // `status=all` read by patching that date in; the presentation
          // split is derived from it, so the row changes sections without a
          // full-history refetch.
          const killDate = data.kill_date;
          if (killDate != null) {
            patchRotationStatusAllRow(dispatch, getState as () => RootState, data.id, (row) => {
              row.rotation_kill_date = killDate;
            });
          } else {
            // A response without the date leaves the patch unwritable; fall
            // back to the refetch the patch normally replaces rather than
            // leave the row rendering as active.
            dispatch(rotationApi.util.invalidateTags([ROTATION_STATUS_ALL_TAG]));
          }
          // The request carries only `rotation_id`, so the album whose cached
          // catalog rows need clearing is knowable only from the updated row.
          // Entries that never linked to a library album have none, and there
          // is nothing in the catalog to patch for them. `RotationEntry.album_id`
          // is typed as a required `number` in the shared contract, but the
          // underlying column is nullable — this guard is reachable in
          // production and must not be deleted as dead code on the strength
          // of the type alone.
          if (typeof data.album_id !== "number") return;
          // Retiring a superseded entry says nothing about the album's
          // rotation, so clearing here would retract a newer entry the cache
          // already records. The set gesture adds the replacement before
          // retiring the prior entries (see `useAlbumRotationActions`), so on a
          // re-bin this handler runs last and its unconditional clear used to
          // win -- leaving the catalog cache reporting the album as unrotated,
          // and dropping the row out of a rotation-filtered list entirely. A
          // cache that records nothing for the album is not a competing claim:
          // clear in that case, so a plain kill still writes the "no rotation"
          // override that shadows the server's own value until the next read.
          const claimed = cachedAlbumRotationId(
            getState as () => RootState,
            data.album_id,
          );
          if (claimed !== undefined && claimed !== data.id) return;
          patchCatalogSearchRotation(
            dispatch,
            getState as () => RootState,
            data.album_id,
            { rotation_bin: undefined, rotation_id: undefined, card: null },
          );
        } catch {
          // A rejected `queryFulfilled` (mutation failure or the cache patch
          // itself throwing) must not escape this handler: RTK Query treats
          // an onQueryStarted rejection as an unhandled promise rejection,
          // and the caller's own `.unwrap()` already owns surfacing the
          // failure to the user (toast). Swallowing here avoids reporting
          // the same failure twice.
        }
      },
    }),
    // The station's named rotation cards (a physical bin slot: bin + number +
    // optional label), CRUD against `library/rotation/cards`. Distinct list
    // tag from `Rotation` -- a card add/rename never changes which albums are
    // in rotation, so tying the two together would refetch every rotation
    // list on a card rename.
    getRotationCards: builder.query<RotationCard[], void>({
      query: () => ({ url: "/cards" }),
      providesTags: [ROTATION_CARDS_LIST_TAG],
    }),
    addRotationCard: builder.mutation<RotationCard, AddRotationCardRequest>({
      query: (body) => ({ url: "/cards", method: "POST", body }),
      invalidatesTags: [ROTATION_CARDS_LIST_TAG],
    }),
    updateRotationCard: builder.mutation<
      RotationCard,
      { id: number } & UpdateRotationCardRequest
    >({
      query: ({ id, ...body }) => ({ url: `/cards/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [
        ROTATION_CARDS_LIST_TAG,
        { type: "RotationCards", id },
      ],
    }),
    deleteRotationCard: builder.mutation<void, number>({
      query: (id) => ({ url: `/cards/${id}`, method: "DELETE" }),
      invalidatesTags: [ROTATION_CARDS_LIST_TAG],
    }),
    getRotationTracks: builder.query<RotationTrack[], number>({
      query: (rotationId) => ({
        url: `/${rotationId}/tracks`,
      }),
    }),
    // The classic list's Active facet. Distinct from `getRotation` above,
    // which converts the same `GET /library/rotation` response into
    // `AlbumEntry[]` for the modern add-to-rotation picker and drops every
    // field that conversion doesn't read (`rotation_id`, `rotation_bin`,
    // `rotation_add_date`, `rotation_kill_date`) -- exactly the fields the
    // classic list's Type/Added/Killed columns and Kill/Unkill actions need.
    // A second endpoint against the same URL costs a second request when a
    // page uses both shapes; no page does today.
    // Opts out of the shared soft-JSON-failure handling
    // (`surfaceNonJsonAsError`), matching `getUncataloguedRotation` below: a
    // query-fed list must never render an unissued or failed request as "there
    // are none", and the Active facet reading a backend outage as "no
    // releases are active" is exactly that failure.
    // `status` narrows Backend's own facet filter (`all` | `active` |
    // `killed`) via `?status=`. `uncataloged` is unrepresentable here by
    // construction (`RotationListStatusFilter` excludes it) -- that facet is
    // `getUncataloguedRotation` below, a distinct read against a distinct
    // backlog. Defaults to `active`, this endpoint's original (and only)
    // behavior before this arg existed.
    getRotationList: builder.query<RotationListRow[], RotationListStatusFilter | void>({
      query: (status) => ({
        url: "",
        params: { status: status ?? DEFAULT_ROTATION_STATUS_FILTER },
      }),
      extraOptions: { surfaceNonJsonAsError: true },
      // The `status=all` entry is tagged apart from the bounded facets: it is
      // the unbounded full-history read, and the row writes below move rows
      // in it by patch (see `patchRotationStatusAllRow`) rather than by the
      // refetch the other facets take.
      providesTags: (_result, _error, status) =>
        (status ?? DEFAULT_ROTATION_STATUS_FILTER) === "all"
          ? [ROTATION_STATUS_ALL_TAG]
          : [ROTATION_LIST_TAG],
    }),
    // The Awaiting Cataloging queue (`GET /library/rotation/uncatalogued`, the
    // cataloging-backlog read Backend's relaxed rotation-add path pairs with).
    // `limit`/`offset` are passed straight through as query params; omitting
    // the arg omits both, which Backend treats as "the default page"
    // (`UNCATALOGUED_ROTATION_MAX_LIMIT`, currently 500) rather than "no
    // rows" -- there is no arg shape here that could send `limit=0`.
    //
    // Opts out of the shared soft-JSON-failure handling
    // (`surfaceNonJsonAsError`), matching `labelsApi.searchLabels`: an empty
    // rotation queue is exactly the state a query-fed list must never render
    // an outage as, and the shared base query's default behavior for a
    // non-JSON body is exactly a silent empty list.
    getUncataloguedRotation: builder.query<
      RotationRowSummary[],
      { limit?: number; offset?: number } | void
    >({
      query: (args) => ({ url: "/uncatalogued", params: args ?? undefined }),
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: [ROTATION_LIST_TAG],
    }),
    // `POST /library/rotation` for a release with no catalogued album (the
    // free-text path Backend added alongside the cataloging-backlog read
    // above) -- distinct from `addRotationEntry` above,
    // which is typed against the published `AddRotationRequest` and requires
    // `album_id`. The response is the full raw `rotation` row, a superset of
    // `RotationRowSummary`'s fields.
    addFreeTextRotationEntry: builder.mutation<RotationRowSummary, FreeTextRotationAddRequest>({
      query: (body) => ({ url: "", method: "POST", body }),
      transformErrorResponse: wrapRotationWriteError,
      invalidatesTags: ["Rotation"],
    }),
    // The single rotation row behind the import screen
    // (`GET /library/rotation/:id`), answering for linked and unlinked rows
    // alike. Neither existing read substitutes: `getRotationList` collapses
    // its rows on the library join, and `getUncataloguedRotation` filters
    // `album_id IS NULL` behind a page cap against a backlog of thousands, so
    // "absent from that page" conflates *linked* with *past the window*.
    //
    // Opts out of the shared soft-JSON-failure handling
    // (`surfaceNonJsonAsError`) for a sharper reason than the lists above.
    // This query is also the pre-create staleness check, and a soft-handled
    // non-JSON body resolves to a successful `undefined` -- which reads as
    // "no such row, therefore not linked" and licenses creating a second
    // library release for a release someone has already catalogued.
    getRotationRow: builder.query<RotationRowSummary, number>({
      query: (rotationId) => ({ url: `/${rotationId}` }),
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: (_result, _error, rotationId) => [{ type: "Rotation", id: rotationId }],
    }),
    // `PATCH /library/rotation/:rotation_id/link` -- the second half of one
    // user action, never a step a librarian is trusted to remember: the pile
    // of unlinked rotation rows this screen exists to work through is the
    // measured cost of a design where linking lived on its own screen.
    //
    // Refusals are wrapped out of the shared rejected-query middleware's
    // `payload.data.message` lookup, matching `addFreeTextRotationEntry` and
    // `deleteAlbum`. Every one of them lands on a screen that states the
    // refusal itself and names the library release this submission already
    // created; a second, vaguer sentence toasted over that reports one
    // failure twice. `lib/features/rotation/importOutcome.ts` is the one
    // owner of reading the wrapped rejection.
    linkRotationToAlbum: builder.mutation<RotationRowSummary, LinkRotationArgs>({
      query: ({ rotation_id, album_id }) => ({
        url: `/${rotation_id}/link`,
        method: "PATCH",
        body: { album_id },
      }),
      transformErrorResponse: (
        response: FetchBaseQueryError,
      ): { linkRotationError: FetchBaseQueryError } => ({ linkRotationError: response }),
      invalidatesTags: ["Rotation"],
    }),
    // `PATCH /library/rotation/:id`, the field-level rotation editor: the
    // classic modify screen's save, and the list's Unkill (which is this same
    // write with `kill_date: null` and nothing else). Distinct from
    // `killRotationEntry` above, which hits the *other* rotation PATCH route
    // (`PATCH /library/rotation`, no `:id`) that only ever sets a kill date --
    // there is no bodied "clear" shape on that route, so clearing one has to
    // be the field-level editor instead.
    //
    // Partial by construction: `rotation_id` names the row in the path and
    // every other key travels in the body, so a key the caller left off is
    // never sent and never written.
    updateRotationRow: builder.mutation<RotationRowSummary, UpdateRotationArgs>({
      query: ({ rotation_id, ...body }) => ({
        url: `/${rotation_id}`,
        method: "PATCH",
        body,
      }),
      transformErrorResponse: wrapRotationWriteError,
      // A card move changes which rows sit on which card — counts the cards
      // surface reports — so it crosses the tag wall the two registries were
      // split by. Only a card move: the split exists so a card rename never
      // refetches every rotation list, and the same wall must hold in
      // reverse for a plain date or snapshot edit.
      //
      // The `status=all` read joins in only for a snapshot edit. `kill_date`
      // and `card_id` are the rotation row's own in the list shape and the
      // summary alike, so those two writes are patched into the cached list
      // below; the snapshot keys collide with the library join's columns on
      // a linked row (see `RotationRowSummary`'s referent rule), so a write
      // carrying any of them re-serves the list instead.
      invalidatesTags: (_result, _error, arg) => {
        // Key-exclusion rather than a snapshot-key list so a key added to
        // `UpdateRotationArgs` later fails safe: unknown means refetch, not
        // silently-stale patch.
        const snapshotEdited = Object.entries(arg).some(
          ([key, value]) =>
            key !== "rotation_id" && key !== "kill_date" && key !== "card_id" && value !== undefined,
        );
        return [
          ROTATION_LIST_TAG,
          ...(arg.card_id === undefined ? [] : [ROTATION_CARDS_LIST_TAG]),
          ...(snapshotEdited ? [ROTATION_STATUS_ALL_TAG] : []),
        ];
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // The response is the updated row, so the screen that saved it
          // already holds every byte a refetch would fetch -- and refetching
          // would rebuild the form under the librarian who just submitted it.
          dispatch(rotationApi.util.upsertQueryData("getRotationRow", arg.rotation_id, data));
          // Move the row in the cached `status=all` read for the two writes
          // whose result is fully known client-side (see `invalidatesTags`
          // above): the kill-date change rides the response, and the card
          // rides the cards cache -- the summary response carries no `card`,
          // and every surface offering the move renders its options from
          // that same cache, so the entity is there to copy.
          const movedCard =
            arg.card_id === undefined
              ? undefined
              : rotationApi.endpoints.getRotationCards
                  .select()(getState() as RootState)
                  .data?.find((card) => card.id === arg.card_id);
          patchRotationStatusAllRow(dispatch, getState as () => RootState, arg.rotation_id, (row) => {
            if (arg.kill_date !== undefined) row.rotation_kill_date = data.kill_date ?? null;
            if (movedCard !== undefined) row.card = movedCard;
          });
          if (arg.card_id !== undefined && movedCard === undefined) {
            // A caller moved a card this tab never loaded; re-serve the list
            // rather than leave the row claiming its old card.
            dispatch(rotationApi.util.invalidateTags([ROTATION_STATUS_ALL_TAG]));
          }
          // The mirror image of `killRotationEntry`'s patch, and not
          // optional: that handler writes a per-album "no rotation" override
          // into the catalog slice, which shadows the server's own value on
          // every later read. Without this, unkilling a release the same
          // session killed leaves the catalog search results claiming it is
          // out of rotation for as long as the tab is open -- a refetch does
          // not clear the override, only another write to it does.
          // `album_id` is null on a rotation row that never linked to a
          // library album; there is nothing in the catalog to patch for one.
          if (typeof data.album_id !== "number") return;
          // Keyed on whether the row is in rotation *today*, not on whether it
          // carries a kill date: this same write can set one as well as clear
          // it, and a kill scheduled for next week leaves the release in
          // rotation until that date arrives.
          const inRotation = isRotationRowActive(data.kill_date);
          // Clearing the badge is a claim about the album, not about this row,
          // so it defers to a cached claim naming a different rotation entry
          // exactly as `killRotationEntry` does: correcting a killed row's
          // dates must not retract the badge of the live row that replaced it.
          if (!inRotation) {
            const claimed = cachedAlbumRotationId(getState as () => RootState, data.album_id);
            if (claimed !== undefined && claimed !== data.id) return;
          }
          // `card` is asymmetric across the two arms on purpose. Every kill
          // path clears it (matching `killRotationEntry`): a killed row must
          // never keep pointing at a card it left. The in-rotation arm omits
          // the key — this endpoint cannot change a card, so it has none to
          // report, and the response carries none (`RotationRowSummary` has
          // no `card`). Because kills always clear, an unkill finds no
          // pre-kill card to resurrect; the row degrades to bin-only until
          // the next search read reports the card the server refiled it on.
          patchCatalogSearchRotation(
            dispatch,
            getState as () => RootState,
            data.album_id,
            inRotation
              ? { rotation_bin: data.rotation_bin, rotation_id: data.id }
              : { rotation_bin: undefined, rotation_id: undefined, card: null },
          );
        } catch {
          // Swallowed rather than rethrown: RTK Query reads a rejection here as
          // an unhandled promise rejection, and the caller's own `.unwrap()`
          // already owns surfacing the failure.
        }
      },
    }),
  }),
});

/**
 * Applies `apply` to the row in every cached `status=all` list entry. The
 * row-action writes (kill, unkill, card move) use this to move a row between
 * the management list's presentations without refetching the unbounded
 * full-history read -- the same `selectCachedArgsForQuery` +
 * `updateQueryData` shape as the catalog's `patchCatalogSearchCaches`. A row
 * absent from a cached entry is left absent: only the bare-`"Rotation"`
 * writers (adds, links, filings) can introduce rows, and they invalidate.
 */
function patchRotationStatusAllRow(
  dispatch: AppDispatch,
  getState: () => RootState,
  rotationId: number,
  apply: (row: RotationListRow) => void,
): void {
  for (const status of rotationApi.util.selectCachedArgsForQuery(getState(), "getRotationList")) {
    if ((status ?? DEFAULT_ROTATION_STATUS_FILTER) !== "all") continue;
    dispatch(
      rotationApi.util.updateQueryData("getRotationList", status, (draft) => {
        const row = draft.find((candidate) => candidate.rotation_id === rotationId);
        if (row) apply(row);
      }),
    );
  }
}

export type RotationTrack = {
  position: string;
  title: string;
  duration: string | null;
  artists: string[];
};

export const {
  useGetRotationQuery,
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
  useGetRotationCardsQuery,
  useAddRotationCardMutation,
  useUpdateRotationCardMutation,
  useDeleteRotationCardMutation,
  useGetRotationTracksQuery,
  useGetRotationListQuery,
  useGetUncataloguedRotationQuery,
  useGetRotationRowQuery,
  useLazyGetRotationRowQuery,
  useLinkRotationToAlbumMutation,
  useAddFreeTextRotationEntryMutation,
  useUpdateRotationRowMutation,
  usePrefetch: useRotationPrefetch,
} = rotationApi;
