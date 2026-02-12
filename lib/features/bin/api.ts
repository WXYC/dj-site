import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { AlbumEntry } from "../catalog/types";
import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import { convertAlbumFromBin } from "./conversions";
import { BinMutationQuery, DJBinQuery } from "./types";

export const binApi = createApi({
  reducerPath: "binApi",
  baseQuery: backendBaseQuery("djs/bin"),
  tagTypes: ["Bin"],
  endpoints: (builder) => ({
    getBin: builder.query<AlbumEntry[], DJBinQuery>({
      query: ({ dj_id }) => ({
        url: `/?dj_id=${dj_id}`,
      }),
      transformResponse: (response: BinLibraryDetails[]) =>
        response.map(convertAlbumFromBin),
      providesTags: ["Bin"],
    }),
    deleteFromBin: builder.mutation<void, BinMutationQuery>({
      query: ({ dj_id, album_id }) => ({
        url: `/?dj_id=${dj_id}&album_id=${album_id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Bin"],
    }),
    addToBin: builder.mutation<void, BinMutationQuery>({
      query: (body) => ({
        url: `/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Bin"],
    }),
  }),
});

export const { useGetBinQuery, useDeleteFromBinMutation, useAddToBinMutation } =
  binApi;
