import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { convertAlbumFromRotation } from "../catalog/conversions";
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
        response.map(convertAlbumFromRotation),
      providesTags: ["Rotation"],
    }),
    addRotationEntry: builder.mutation<any, RotationParams>({
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
  }),
});

export const {
  useGetRotationQuery,
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
} = rotationApi;
