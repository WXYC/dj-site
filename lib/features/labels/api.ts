import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { LabelRow, SearchLabelsParams } from "./types";

export const labelsApi = createApi({
  reducerPath: "labelsApi",
  baseQuery: backendBaseQuery("labels"),
  endpoints: (builder) => ({
    searchLabels: builder.query<LabelRow[], SearchLabelsParams>({
      query: ({ q, limit }) => ({
        url: "/search",
        params: { q, limit },
      }),
      transformResponse: (response: LabelRow[] | null): LabelRow[] =>
        response ?? [],
    }),
  }),
});

export const { useSearchLabelsQuery } = labelsApi;
