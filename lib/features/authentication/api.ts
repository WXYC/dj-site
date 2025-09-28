import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import {
  AccountModification,
  AuthenticationData,
  BackendAccountModification,
  Credentials,
  DJInfoResponse,
  DJRegistryParams,
  DJRegistryRequestParams,
  ResetPasswordRequest,
} from "./types";

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
    modifyUser: builder.mutation<void, AccountModification>({
      query: (modification) => ({
        url: "",
        method: "PATCH",
        body: modification,
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
        method: "GET",
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
  useModifyUserMutation,
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
    modDJInfo: builder.mutation<DJInfoResponse, BackendAccountModification>({
      query: (params) => ({
        url: "/register",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["DJInfo"],
    }),
    getDJInfo: builder.query<DJInfoResponse, DJRegistryRequestParams>({
      query: (params) => ({
        url: "",
        params,
      }),
      providesTags: ["DJInfo"],
    }),
    deleteDJInfo: builder.mutation<void, string>({
      query: (cognito_user_name) => ({
        url: "",
        method: "DELETE",
        body: { cognito_user_name },
      }),
      invalidatesTags: ["DJInfo"],
    }),
  }),
});

export const {
  useRegisterDJMutation,
  useGetDJInfoQuery,
  useModDJInfoMutation,
  useDeleteDJInfoMutation,
} = djRegistryApi;
