import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { LabelRow, SearchLabelsParams } from "./types";

export const labelsApi = createApi({
  reducerPath: "labelsApi",
  baseQuery: backendBaseQuery("labels"),
  tagTypes: ["LabelSearch"],
  endpoints: (builder) => ({
    searchLabels: builder.query<LabelRow[], SearchLabelsParams>({
      query: ({ q, limit }) => ({
        url: "/search",
        params: { q, limit },
      }),
      // The shared base query soft-fails an unparseable body — a gateway's HTML
      // 502, Express's HTML 404 — into a successful `null` payload. For a
      // duplicate check that resolves to "no existing label matched", which is
      // the one answer an unreachable backend cannot give: the consumer would
      // render its create affordance and the librarian would file the very
      // near-duplicate this endpoint exists to surface. Opt out so an outage
      // reaches consumers as an error they can refuse to act on.
      extraOptions: { surfaceNonJsonAsError: true },
      transformResponse: (response: LabelRow[] | null): LabelRow[] =>
        response ?? [],
      // Label creation is an upsert on the exact name, so a stale empty result
      // served from cache after a label was created sends the next search back
      // through the create path and produces a second row. The only writer is
      // the release-creation mutation, which lives in a different `createApi`
      // — and `invalidatesTags` does not reach across instances. It has to
      // dispatch `labelsApi.util.invalidateTags` for this tag to do anything.
      providesTags: [{ type: "LabelSearch", id: "LIST" }],
    }),
  }),
});

export const { useSearchLabelsQuery } = labelsApi;
