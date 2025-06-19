import { UserType } from "@aws-sdk/client-cognito-identity-provider";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { convertAWSToAcccountResult } from "./conversions";
import { Account, NewAccountParams, PromotionParams } from "./types";

export const adminApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/admin" }),
  reducerPath: "adminApi",
  tagTypes: ["DJs"],
  endpoints: (builder) => ({
    listAccounts: builder.query<Account[], void>({
      query: () => "/djs",
      providesTags: ["DJs"],
    }),
    createAccount: builder.mutation<void, NewAccountParams>({
      query: (params) => ({
        url: "/djs",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["DJs"],
    }),
    deleteAccount: builder.mutation<void, string>({
      query: (username) => ({
        url: `/djs`,
        method: "DELETE",
        body: { username },
      }),
      invalidatesTags: ["DJs"],
    }),
    promoteAccount: builder.mutation<void, PromotionParams>({
      query: (params) => ({
        url: "/djs",
        method: "PATCH",
        body: params,
      }),
    }),
  }),
});

export const {
  useListAccountsQuery,
  useCreateAccountMutation,
  useDeleteAccountMutation,
  usePromoteAccountMutation,
} = adminApi;
