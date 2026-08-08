import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendBaseQuery } from "../backend";
import { Label, SearchLabelsParams } from "./types";

export const labelsApi = createApi({
  reducerPath: "labelsApi",
  baseQuery: backendBaseQuery("labels"),
  tagTypes: ["LabelSearch"],
  endpoints: (builder) => ({
    searchLabels: builder.query<Label[], SearchLabelsParams>({
      query: ({ q, limit }) => ({
        url: "/search",
        params: { q, limit },
      }),
      // The shared base query soft-fails an unparseable body — a gateway's HTML
      // 502, Express's HTML 404 — into a successful `null` payload, which here
      // resolves to "no existing label matched". That is the one answer an
      // unreachable backend cannot honestly give: the consumer renders its
      // create affordance and the librarian files the very near-duplicate this
      // endpoint exists to surface. Opt out so an outage reaches consumers as
      // an error they can refuse to act on.
      extraOptions: { surfaceNonJsonAsError: true },
      transformResponse: (response: Label[] | null): Label[] =>
        response ?? [],
      // The picker renders its own inline outage panel (role="alert") for
      // every shape of failure here, so the shared rtk-query-error-logger
      // middleware reporting the same failure again as a global toast is a
      // second, redundant surface for one event — worse, a screen reader
      // announces both. That middleware keys its toast branches off
      // `payload.data.message`, `payload.status`, and `payload.error`;
      // nesting the real error under a key it never inspects keeps this
      // endpoint's failures out of the global toast without touching that
      // shared module. Its unconditional PostHog capture still fires for
      // every searchLabels failure (it is not behind any of those checks),
      // but builds its message from `data.message` and `error`, both of which
      // the nesting hides — so the trade for silencing the toast is a generic
      // "RTK Query error" capture carrying no status or body, still tagged
      // with `endpoint: "searchLabels"` from the action's own metadata.
      transformErrorResponse: (
        response: FetchBaseQueryError,
      ): { searchLabelsError: FetchBaseQueryError } => ({
        searchLabelsError: response,
      }),
      // The only writer of labels is the release-creation mutation, which
      // lives in a different `createApi` — `invalidatesTags` does not reach
      // across API instances, so it has to dispatch
      // `labelsApi.util.invalidateTags` for this tag to do anything. That
      // cross-slice invalidation is the whole reason the tag exists: it is
      // not preventing a duplicate row. `labelsService.createLabel` upserts
      // with `onConflictDoNothing({ target: labels.label_name })` and
      // re-selects, so resubmitting an identical label name can never create
      // a second row — a duplicate needs a different string, which is a
      // different cache key and so was never at risk from a stale entry here.
      providesTags: [{ type: "LabelSearch", id: "LIST" }],
    }),
  }),
});

export const { useSearchLabelsQuery } = labelsApi;
