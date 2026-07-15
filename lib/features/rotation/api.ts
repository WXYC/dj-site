import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { convertToAlbumEntry } from "../catalog/conversions";
import { AlbumEntry, AlbumSearchResultJSON } from "../catalog/types";
import type { AddRotationRequest } from "@wxyc/shared";
import { KillRotationParams } from "./types";

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
    addRotationEntry: builder.mutation<any, AddRotationRequest>({
      query: (rotation) => ({
        url: "",
        method: "POST",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
    }),
    killRotationEntry: builder.mutation<any, KillRotationParams>({
      query: (rotation) => ({
        url: "",
        method: "PATCH",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
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
