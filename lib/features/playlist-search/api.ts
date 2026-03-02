import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import type {
  PlaylistSearchParams,
  PlaylistSearchResponse,
} from "@wxyc/shared";

export const playlistSearchApi = createApi({
  reducerPath: "playlistSearchApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    searchPlaylists: builder.query<PlaylistSearchResponse, PlaylistSearchParams>({
      query: ({ q, page = 0, limit = 50, sort = "date", order = "desc" }) => ({
        url: "/search",
        params: { q, page, limit, sort, order },
      }),
    }),
  }),
});

export const { useSearchPlaylistsQuery, useLazySearchPlaylistsQuery } = playlistSearchApi;
