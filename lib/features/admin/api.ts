import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Account, NewAccountParams, PromotionParams } from "./types";

export const adminApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/admin" }),
  reducerPath: "adminApi",
  tagTypes: ["Accounts"],
  endpoints: (builder) => ({
    listAccounts: builder.query<Account[], void>({
      query: () => "/djs",
      providesTags: ["Accounts"],
      transformResponse: (response: { users: Account[] }) => response.users,
    }),
    createAccount: builder.mutation<void, NewAccountParams>({
      query: (params) => ({
        url: "/djs",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["Accounts"],
    }),
    deleteAccount: builder.mutation<void, string>({
      query: (username) => ({
        url: `/djs`,
        method: "DELETE",
        body: { username },
      }),
      invalidatesTags: ["Accounts"],
    }),
    promoteAccount: builder.mutation<void, PromotionParams>({
      query: (params) => ({
        url: "/djs",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["Accounts"],
    }),
    resetPassword: builder.mutation<void, string>({
      query: (username) => ({
        url: `/password`,
        method: "PATCH",
        body: { username },
      }),
      invalidatesTags: ["Accounts"],
    }),
  }),
});

export const {
  useListAccountsQuery,
  useCreateAccountMutation,
  useDeleteAccountMutation,
  usePromoteAccountMutation,
  useResetPasswordMutation,
} = adminApi;
