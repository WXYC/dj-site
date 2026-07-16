import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ColorMode, ExperienceId } from "./types";
import { AppSkinPreference } from "./preferences";

interface ExperienceResponse {
  experience: ExperienceId;
}

interface ExperiencePreferenceResponse extends ExperienceResponse {
  colorMode: ColorMode;
  themeId: string;
  preference: AppSkinPreference;
}

interface ExperiencePreferenceRequest {
  preference: AppSkinPreference;
}

export const experienceApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/experiences" }),
  reducerPath: "experienceApi",
  tagTypes: ["Experience"],
  endpoints: (builder) => ({
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
  useSwitchExperienceMutation,
  useSetExperiencePreferenceMutation,
} = experienceApi;

