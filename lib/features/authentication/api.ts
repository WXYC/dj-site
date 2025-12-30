import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import {
  BackendAccountModification,
  DJInfoResponse,
  DJRegistryParams,
  DJRegistryRequestParams,
} from "./types";

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
