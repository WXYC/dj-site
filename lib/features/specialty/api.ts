import { createApi } from "@reduxjs/toolkit/query/react";
import type { SpecialtyShow } from "@wxyc/shared";
import { backendBaseQuery } from "../backend";

export const specialtyApi = createApi({
  reducerPath: "specialtyApi",
  baseQuery: backendBaseQuery("specialty-shows"),
  endpoints: (builder) => ({
    // Public and served `max-age=300`, so the browser's HTTP cache already
    // bounds the refetch; the program list changes a few times a year.
    getSpecialtyShows: builder.query<SpecialtyShow[], void>({
      query: () => ({ url: "" }),
      // The shared base query soft-fails an unparseable body to null.
      transformResponse: (response: SpecialtyShow[] | null) => response ?? [],
    }),
  }),
});

export const { useGetSpecialtyShowsQuery } = specialtyApi;
