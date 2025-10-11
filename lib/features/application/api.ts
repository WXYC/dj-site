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
    /**
     * @deprecated Use useGetActiveExperienceQuery from experienceApi instead
     */
    getClassic: builder.query<boolean, void>({
      query: () => "",
      providesTags: ["Experience"],
      transformResponse: (response: ApplicationState) => response.experience === "classic",
    }),
    getRightbar: builder.query<boolean, void>({
      query: () => "",
      providesTags: ["Rightbar"],
      transformResponse: (response: ApplicationState) => response.rightBarMini,
    }),
    /**
     * @deprecated Use useSwitchExperienceMutation from experienceApi instead
     */
    toggleClassic: builder.mutation<boolean, void>({
      query: () => ({
        url: "/classic",
        method: "POST",
      }),
      invalidatesTags: ["Experience"],
      transformResponse: (response: ApplicationState) => response.experience === "classic",
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
