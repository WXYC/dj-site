import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ExperienceId } from "./types";

/**
 * Response type for experience API
 */
interface ExperienceResponse {
  experience: ExperienceId;
}

/**
 * RTK Query API for experience management
 */
export const experienceApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/experiences" }),
  reducerPath: "experienceApi",
  tagTypes: ["Experience"],
  endpoints: (builder) => ({
    getActiveExperience: builder.query<ExperienceId, void>({
      query: () => "/active",
      providesTags: ["Experience"],
      transformResponse: (response: ExperienceResponse) => response.experience,
    }),
    switchExperience: builder.mutation<ExperienceId, ExperienceId>({
      query: (experienceId) => ({
        url: "/switch",
        method: "POST",
        body: { experience: experienceId },
      }),
      invalidatesTags: ["Experience"],
      transformResponse: (response: ExperienceResponse) => response.experience,
    }),
  }),
});

export const {
  useGetActiveExperienceQuery,
  useSwitchExperienceMutation,
} = experienceApi;

