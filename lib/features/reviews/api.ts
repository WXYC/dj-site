import { createApi } from "@reduxjs/toolkit/query/react";
import type { IntakeItem, IntakeItemState } from "@wxyc/shared";
import { backendBaseQuery } from "../backend";

export const reviewsApi = createApi({
  reducerPath: "reviewsApi",
  baseQuery: backendBaseQuery("intake"),
  tagTypes: ["Intake"],
  endpoints: (builder) => ({
    getIntakeItems: builder.query<IntakeItem[], { state?: IntakeItemState } | void>({
      query: (args) => ({
        url: "",
        params: args && args.state ? { state: args.state } : undefined,
      }),
      providesTags: ["Intake"],
    }),
  }),
});

export const { useGetIntakeItemsQuery } = reviewsApi;
