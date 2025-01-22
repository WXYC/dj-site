import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { AuthenticationData, Credentials } from "./types";

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
      transformResponse: (response: any) => {
        console.log("response", response);
        return response;
      },
      invalidatesTags: ["Authentication"],
    }),
    getAuthentication: builder.query<AuthenticationData, void>({
      query: () => "",
      transformResponse: (response: any) => {
        console.log("response", response);
        return response;
      },
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
