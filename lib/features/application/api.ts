import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ApplicationState } from "./types";

export const applicationApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/view" }),
  reducerPath: "applicationApi",
  tagTypes: ["Classic"],
  endpoints: (builder) => ({
    getClassic: builder.query<boolean, void>({
      query: () => "",
      providesTags: ["Classic"],
      transformResponse: (response: ApplicationState) => response.classic,
    }),
    toggleClassic: builder.mutation<boolean, void>({
      query: () => ({
        url: "",
        method: "POST",
      }),
      invalidatesTags: ["Classic"],
      transformResponse: (response: ApplicationState) => response.classic,
    }),
  }),
});


export const { useGetClassicQuery, useToggleClassicMutation } = applicationApi;