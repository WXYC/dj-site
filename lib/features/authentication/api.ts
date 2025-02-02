import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { AuthenticationData, Credentials, DJRegistryParams, DJRegistryRequestParams } from "./types";

export const authenticationApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/authentication" }),
  reducerPath: "authenticationApi",
  tagTypes: ["Authentication"],
  endpoints: (builder) => ({
    login: builder.mutation<AuthenticationData, Credentials>({
      query: (credentials) => ({
        url: "",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Authentication"],
    }),
    getAuthentication: builder.query<AuthenticationData, void>({
      query: () => "",
      providesTags: ["Authentication"],
    }),
    logout: builder.mutation<AuthenticationData, void>({
      query: () => ({
        url: "",
        method: "DELETE",
      }),
      invalidatesTags: ["Authentication"],
    }),
  }),
});

export const {
  useGetAuthenticationQuery,
  useLoginMutation,
  useLogoutMutation,
} = authenticationApi;

export const djRegistryApi = createApi({
  baseQuery: backendBaseQuery("djs"),
  reducerPath: "djRegistryApi",
  tagTypes: ["DJInfo"],
  endpoints: (builder) => ({
    registerDJ: builder.mutation<any, DJRegistryParams>({
      query: (dj) => ({
        url: "/register",
        method: "POST",
        body: dj,
      }),
      invalidatesTags: ["DJInfo"],
    }),
    getDJInfo: builder.query<any, DJRegistryRequestParams>({
      query: (params) => ({
        url: "/",
        params,
      }),
      providesTags: ["DJInfo"],
    }),
  }),
});

export const { useRegisterDJMutation, useGetDJInfoQuery } = djRegistryApi;
