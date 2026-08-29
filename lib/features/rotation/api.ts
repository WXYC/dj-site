import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { RootState } from "@/lib/store";
import { backendBaseQuery } from "../backend";
import { convertToAlbumEntry } from "../catalog/conversions";
import { patchCatalogSearchRotation } from "../catalog/patchSearchCaches";
import { AlbumEntry, AlbumSearchResultJSON } from "../catalog/types";
import type {
  AddRotationRequest,
  KillRotationRequest,
  RotationEntry,
} from "@wxyc/shared";
import type {
  FreeTextRotationAddRequest,
  RotationListRow,
  UncataloguedRotationRow,
} from "./types";

export const rotationApi = createApi({
  reducerPath: "rotationApi",
  baseQuery: backendBaseQuery("library/rotation"),
  tagTypes: ["Rotation"],
  endpoints: (builder) => ({
    getRotation: builder.query<AlbumEntry[], void>({
      query: () => ({
        url: "",
      }),
      transformResponse: (response: AlbumSearchResultJSON[] | null) =>
        response ? response.map(convertToAlbumEntry) : [],
      providesTags: ["Rotation"],
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
            { rotation_bin, rotation_id: data.id },
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
      invalidatesTags: ["Rotation"],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // The request carries only `rotation_id`, so the album whose cached
          // catalog rows need clearing is knowable only from the updated row.
          // Entries that never linked to a library album have none, and there
          // is nothing in the catalog to patch for them. `RotationEntry.album_id`
          // is typed as a required `number` in the shared contract, but the
          // underlying column is nullable — this guard is reachable in
          // production and must not be deleted as dead code on the strength
          // of the type alone.
          if (typeof data.album_id !== "number") return;
          patchCatalogSearchRotation(
            dispatch,
            getState as () => RootState,
            data.album_id,
            { rotation_bin: undefined, rotation_id: undefined },
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
    getRotationList: builder.query<RotationListRow[], void>({
      query: () => ({ url: "" }),
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: ["Rotation"],
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
      UncataloguedRotationRow[],
      { limit?: number; offset?: number } | void
    >({
      query: (args) => ({ url: "/uncatalogued", params: args ?? undefined }),
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: ["Rotation"],
    }),
    // `POST /library/rotation` for a release with no catalogued album (the
    // free-text path Backend added alongside the cataloging-backlog read
    // above) -- distinct from `addRotationEntry` above,
    // which is typed against the published `AddRotationRequest` and requires
    // `album_id`. The response is the full raw `rotation` row, a superset of
    // `UncataloguedRotationRow`'s fields.
    //
    // Every refusal from this endpoint (missing rotation_bin, missing
    // artist_name/album_title, an over-length snapshot field) carries a
    // message precise enough to act on, and the caller renders it inline
    // (`RotationReleaseInsert`'s validationMessage, matching the JSP's own
    // div of that name) -- so, like `labelsApi.searchLabels`, the message is
    // nested under a key the shared rejected-query middleware's
    // `payload.data.message` lookup does not recognize, keeping one refusal
    // from being reported twice.
    addFreeTextRotationEntry: builder.mutation<UncataloguedRotationRow, FreeTextRotationAddRequest>({
      query: (body) => ({ url: "", method: "POST", body }),
      transformErrorResponse: (
        response: FetchBaseQueryError,
      ): { rotationAddError: FetchBaseQueryError } => ({
        rotationAddError: response,
      }),
      invalidatesTags: ["Rotation"],
    }),
    // Unkill: `PATCH /library/rotation/:id`, the field-level rotation editor,
    // with `kill_date: null` clears a kill date. Distinct from
    // `killRotationEntry` above, which
    // hits the *other* rotation PATCH route (`PATCH /library/rotation`, no
    // `:id`) that only ever sets a kill date -- there is no bodied "clear"
    // shape on that route, so Unkill has to be the field-level editor
    // instead. A kill_date-only PATCH never touches the artist_name /
    // album_title / record_label snapshot trio, so it can never hit that
    // route's linked-row 409 -- this mutation's response type is the
    // same eight-field projection every `/library/rotation/:id` PATCH
    // returns.
    unkillRotationEntry: builder.mutation<UncataloguedRotationRow, { rotation_id: number }>({
      query: ({ rotation_id }) => ({
        url: `/${rotation_id}`,
        method: "PATCH",
        body: { kill_date: null },
      }),
      invalidatesTags: ["Rotation"],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
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
          patchCatalogSearchRotation(
            dispatch,
            getState as () => RootState,
            data.album_id,
            { rotation_bin: data.rotation_bin, rotation_id: data.id },
          );
        } catch {
          // A rejected `queryFulfilled` (mutation failure or the cache patch
          // itself throwing) must not escape this handler: RTK Query treats
          // an onQueryStarted rejection as an unhandled promise rejection,
          // and the caller's own `.unwrap()` already owns surfacing the
          // failure to the user (toast).
        }
      },
    }),
  }),
});

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
  useGetRotationTracksQuery,
  useGetRotationListQuery,
  useGetUncataloguedRotationQuery,
  useAddFreeTextRotationEntryMutation,
  useUnkillRotationEntryMutation,
  usePrefetch: useRotationPrefetch,
} = rotationApi;
