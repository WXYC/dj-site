import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ColorMode, ExperienceId } from "./types";
import { AppSkinPreference } from "./preferences";

/**
 * Response type for experience API
 */
interface ExperienceResponse {
  experience: ExperienceId;
}

interface ExperiencePreferenceResponse extends ExperienceResponse {
  colorMode: ColorMode;
  preference: AppSkinPreference;
}

interface ExperiencePreferenceRequest {
  preference: AppSkinPreference;
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
    setExperiencePreference: builder.mutation<
      ExperiencePreferenceResponse,
      ExperiencePreferenceRequest
    >({
      query: (payload) => ({
        url: "/preferences",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["Experience"],
    }),
  }),
});

export const {
  useGetActiveExperienceQuery,
  useSwitchExperienceMutation,
  useSetExperiencePreferenceMutation,
} = experienceApi;

