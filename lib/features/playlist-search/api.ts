import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import type {
  PlaylistSearchParams,
  PlaylistSearchResponse,
} from "@wxyc/shared";

// Local extensions until @wxyc/shared adds cursor pagination to api.yaml.
// Backend-Service /flowsheet/search accepts cursor and returns nextCursor;
// see docs/playlist-search/README.md step 3 in that repo. page is optional
// here because cursor mode does not use it (and the backend defaults page
// to 0 when missing); offset-mode callers can still supply it.
export type PlaylistSearchParamsWithCursor = Omit<
  PlaylistSearchParams,
  "page"
> & {
  page?: number;
  cursor?: string;
};

export type PlaylistSearchResponseWithCursor = PlaylistSearchResponse & {
  nextCursor?: string;
};

export const playlistSearchApi = createApi({
  reducerPath: "playlistSearchApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    searchPlaylists: builder.query<
      PlaylistSearchResponseWithCursor,
      PlaylistSearchParamsWithCursor
    >({
      query: ({
        q,
        page = 0,
        limit = 50,
        sort = "date",
        order = "desc",
        cursor,
      }) => ({
        url: "/search",
        // Only forward cursor when defined — sending cursor=undefined would
        // serialize as the literal string "undefined".
        params:
          cursor !== undefined
            ? { q, page, limit, sort, order, cursor }
            : { q, page, limit, sort, order },
      }),
    }),
  }),
});

export const { useSearchPlaylistsQuery, useLazySearchPlaylistsQuery } =
  playlistSearchApi;
