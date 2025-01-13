import { CatalogEntry, SearchParameters } from "@/lib/models";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query";

const BASE_PATH = "library";

export const catalogApi = createApi({
  reducerPath: "catalogApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/${BASE_PATH}`,
  }),
  endpoints: (builder) => ({
    searchCatalog: builder.query<CatalogEntry[], Partial<SearchParameters>>({
      query: ({ artist_name, album_title }) =>
        [artist_name, album_title]
          .filter(Boolean)
          .map((key) => `${key}=${encodeURIComponent(key!)}`)
          .join("&"),
    }),
    addAlbum: builder.mutation<CatalogEntry, Partial<CatalogEntry>>({
      query: (body) => ({
        url: "/",
        method: "POST",
      }),
    }),
  }),
});
