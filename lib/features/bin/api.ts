import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { AlbumEntry } from "../catalog/types";
import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import { convertToAlbumEntry } from "../catalog/conversions";
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
        response.map(convertToAlbumEntry),
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
    clearBin: builder.mutation<null, DJBinQuery>({
      async queryFn({ dj_id }, _api, _extraOptions, baseQuery) {
        const listResult = await baseQuery({
          url: `/?dj_id=${dj_id}`,
        });
        if (listResult.error) {
          return { error: listResult.error };
        }

        const entries = (listResult.data ?? []) as BinLibraryDetails[];
        for (const entry of entries) {
          if (entry.album_id === undefined) {
            continue;
          }
          const delResult = await baseQuery({
            url: `/?dj_id=${dj_id}&album_id=${entry.album_id}`,
            method: "DELETE",
          });
          if (delResult.error) {
            return { error: delResult.error };
          }
        }

        // RTK Query rejects `{ data: undefined }` (serializes to `{}`).
        return { data: null };
      },
      invalidatesTags: ["Bin"],
    }),
  }),
});

export const {
  useGetBinQuery,
  useDeleteFromBinMutation,
  useAddToBinMutation,
  useClearBinMutation,
} = binApi;
