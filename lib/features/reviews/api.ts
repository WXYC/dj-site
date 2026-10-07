import { createApi } from "@reduxjs/toolkit/query/react";
import type { IntakeItem, IntakeItemState } from "@wxyc/shared";
import { backendBaseQuery } from "../backend";

export const reviewsApi = createApi({
  reducerPath: "reviewsApi",
  baseQuery: backendBaseQuery("intake"),
  tagTypes: ["Intake"],
  endpoints: (builder) => ({
    // Opts out of the shared soft-JSON-failure handling
    // (`surfaceNonJsonAsError`), matching `rotationApi.getUncataloguedRotation`:
    // a non-JSON body would otherwise resolve to a successful empty result,
    // and the Pile must never render an outage as "nothing waiting".
    getIntakeItems: builder.query<IntakeItem[], { state?: IntakeItemState } | void>({
      query: (args) => ({
        url: "",
        params: args && args.state ? { state: args.state } : undefined,
      }),
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: ["Intake"],
    }),
  }),
});

export const { useGetIntakeItemsQuery } = reviewsApi;
