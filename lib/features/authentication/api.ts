import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { DJRegistryParams } from "./types";

export const authenticationApi = createApi({
  reducerPath: "authenticationApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/authentication",
    credentials: "include",
  }),
  tagTypes: ["DJRegistry"],
  endpoints: (builder) => ({
    registerDJ: builder.mutation<void, DJRegistryParams>({
      query: (params) => ({
        url: "/dj-registry",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["DJRegistry"],
    }),
    deleteDJInfo: builder.mutation<void, { username: string }>({
      query: ({ username }) => ({
        url: `/dj-registry/${username}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DJRegistry"],
    }),
  }),
});

export const { useRegisterDJMutation, useDeleteDJInfoMutation } = authenticationApi;
