import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ApplicationState } from "./types";

export const applicationApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/view" }),
  reducerPath: "applicationApi",
  tagTypes: ["Classic", "Rightbar"],
  endpoints: (builder) => ({
    getClassic: builder.query<boolean, void>({
      query: () => "",
      providesTags: ["Classic"],
      transformResponse: (response: ApplicationState) => response.classic,
    }),
    getRightbar: builder.query<boolean, void>({
      query: () => "",
      providesTags: ["Rightbar"],
      transformResponse: (response: ApplicationState) => response.rightBarMini,
    }),
    toggleClassic: builder.mutation<boolean, void>({
      query: () => ({
        url: "/classic",
        method: "POST",
      }),
      invalidatesTags: ["Classic"],
      transformResponse: (response: ApplicationState) => response.classic,
    }),
    toggleRightbar: builder.mutation<boolean, void>({
      query: () => ({
        url: "/rightbar",
        method: "POST",
      }),
      invalidatesTags: ["Rightbar"],
      transformResponse: (response: ApplicationState) => response.rightBarMini,
    }),
  }),
});

export const {
  useGetClassicQuery,
  useToggleClassicMutation,
  useGetRightbarQuery,
  useToggleRightbarMutation,
} = applicationApi;
