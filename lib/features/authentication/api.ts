import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { AuthenticationData, Credentials, DJInfoResponse, DJRegistryParams, DJRegistryRequestParams, ResetPasswordRequest } from "./types";
import { request } from "http";

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
    newUser: builder.mutation<AuthenticationData, Credentials>({
      query: (credentials) => ({
        url: "/password",
        method: "PUT",
        body: credentials,
      }),
      invalidatesTags: ["Authentication"],
    }),
    requestPasswordReset: builder.mutation<AuthenticationData, string>({
      query: (username) => ({
        url: `/password?username=${username}`,
        method: "GET"
      }),
      invalidatesTags: ["Authentication"],
    }),
    resetPassword: builder.mutation<AuthenticationData, ResetPasswordRequest>({
      query: (data) => ({
        url: `/password`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Authentication"],
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
  useNewUserMutation,
  useResetPasswordMutation,
  useRequestPasswordResetMutation,
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
    getDJInfo: builder.query<DJInfoResponse, DJRegistryRequestParams>({
      query: (params) => ({
        url: "/",
        params,
      }),
      providesTags: ["DJInfo"],
    }),
  }),
});

export const { useRegisterDJMutation, useGetDJInfoQuery } = djRegistryApi;
