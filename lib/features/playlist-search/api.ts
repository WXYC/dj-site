import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import type {
  PlaylistSearchParams,
  PlaylistSearchResponse,
} from "@wxyc/shared";

// Backend-Service /flowsheet/search accepts an opaque cursor and returns
// nextCursor; @wxyc/shared's api.yaml has not yet added cursor pagination.
export type PlaylistSearchResponseWithCursor = PlaylistSearchResponse & {
  nextCursor?: string;
};

// Search key for the infinite query — everything except pagination. `page` and
// the cursor are supplied per-page from pageParam.
export type PlaylistSearchInfiniteArg = Omit<PlaylistSearchParams, "page">;

// null pageParam = first page; a string pageParam is the opaque nextCursor.
type PlaylistSearchPageParam = string | null;

export const playlistSearchApi = createApi({
  reducerPath: "playlistSearchApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    searchPlaylists: builder.infiniteQuery<
      PlaylistSearchResponseWithCursor,
      PlaylistSearchInfiniteArg,
      PlaylistSearchPageParam
    >({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query({ pageParam, queryArg }) {
        const { q, limit = 50, sort = "date", order = "desc" } = queryArg;
        return {
          url: "/search",
          // Only forward cursor for non-first pages — sending cursor=null
          // would serialize as the literal string "null".
          params:
            pageParam !== null
              ? { q, page: 0, limit, sort, order, cursor: pageParam }
              : { q, page: 0, limit, sort, order },
        };
      },
      transformResponse: (
        response: PlaylistSearchResponseWithCursor | null,
      ): PlaylistSearchResponseWithCursor =>
        response ?? { results: [], total: 0, page: 0, totalPages: 0 },
    }),
  }),
});

export const { useSearchPlaylistsInfiniteQuery } = playlistSearchApi;
