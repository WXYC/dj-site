import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { convertToAlbumEntry } from "../catalog/conversions";
import { AlbumEntry, AlbumSearchResultJSON } from "../catalog/types";
import { KillRotationParams, RotationParams } from "./types";

export const rotationApi = createApi({
  reducerPath: "rotationApi",
  baseQuery: backendBaseQuery("library/rotation"),
  tagTypes: ["Rotation"],
  endpoints: (builder) => ({
    getRotation: builder.query<AlbumEntry[], void>({
      query: () => ({
        url: "",
      }),
      transformResponse: (response: AlbumSearchResultJSON[]) =>
        response.map(convertToAlbumEntry),
      providesTags: ["Rotation"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    addRotationEntry: builder.mutation<any, RotationParams>({
      query: (rotation) => ({
        url: "",
        method: "POST",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    killRotationEntry: builder.mutation<any, KillRotationParams>({
      query: (rotation) => ({
        url: "",
        method: "PATCH",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
    }),
  }),
});

export const {
  useGetRotationQuery,
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
} = rotationApi;
