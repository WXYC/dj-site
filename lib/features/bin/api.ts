import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { AlbumEntry } from "../catalog/types";
import { convertAlbumFromBin } from "./conversions";
import { BinQueryResponse, DJBinQuery } from "./types";

export const binApi = createApi({
  reducerPath: "binApi",
  baseQuery: backendBaseQuery("djs/bin"),
  tagTypes: ["Bin"],
  endpoints: (builder) => ({
    getBin: builder.query<AlbumEntry[], DJBinQuery>({
      query: ({ dj_id }) => ({
        url: `/?dj_id=${dj_id}`,
      }),
      transformResponse: (response: BinQueryResponse[]) =>
        response.map(convertAlbumFromBin),
      providesTags: ["Bin"],
    }),
  }),
});

export const { useGetBinQuery } = binApi;
