import { createApi } from "@reduxjs/toolkit/query/react";
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
        }
      },
    }),
    getRotationTracks: builder.query<RotationTrack[], number>({
      query: (rotationId) => ({
        url: `/${rotationId}/tracks`,
      }),
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
  usePrefetch: useRotationPrefetch,
} = rotationApi;
