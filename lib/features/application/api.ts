import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ExperienceId } from "../experiences/types";
import { ApplicationState } from "./types";

/**
 * Application API
 * Manages application-level settings like rightbar state
 * For experience switching, use experienceApi instead
 */
export const applicationApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/view" }),
  reducerPath: "applicationApi",
  tagTypes: ["Experience", "Rightbar"],
  endpoints: (builder) => ({
    getRightbar: builder.query<boolean, void>({
      query: () => "",
      providesTags: ["Rightbar"],
      transformResponse: (response: ApplicationState) => response.rightBarMini,
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
  useGetRightbarQuery,
  useToggleRightbarMutation,
} = applicationApi;
