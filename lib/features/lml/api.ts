import { createApi } from "@reduxjs/toolkit/query/react";
import type { AlbumEntry } from "../catalog/types";
import { backendBaseQuery } from "../backend";
import { convertLmlItemToAlbumEntry } from "./lml-conversions";
import type { LmlLibrarySearchResponse } from "./types";

export interface LmlSearchArgs {
  artist: string;
  title: string;
  limit?: number;
}

/**
 * RTK Query endpoint for `GET /proxy/library/search` on Backend-Service.
 *
 * Replaces the per-subscriber raw-`fetch` model in `useLmlLibrarySearch` so
 * that N callers with the same `{artist, title}` args share one in-flight
 * request and one cache entry. Auth bearer + `X-Request-Id` come from
 * `backendBaseQuery`; the WXYC/dj-site#519 non-JSON soft-handle is inherited
 * for free. See WXYC/dj-site#563 for the per-subscriber fetch storm this
 * dedupes.
 */
export const lmlApi = createApi({
  reducerPath: "lmlApi",
  baseQuery: backendBaseQuery("proxy"),
  endpoints: (builder) => ({
    searchLibrary: builder.query<AlbumEntry[], LmlSearchArgs>({
      query: ({ artist, title, limit }) => ({
        url: "/library/search",
        params: {
          artist: artist || undefined,
          title: title || undefined,
          limit,
        },
      }),
      transformResponse: (response: LmlLibrarySearchResponse | null) =>
        response?.results ? response.results.map(convertLmlItemToAlbumEntry) : [],
    }),
  }),
});

export const { useSearchLibraryQuery } = lmlApi;
