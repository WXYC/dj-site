import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { EMPTY_SHOW_PLAYLIST, type ShowPlaylistWire } from "./types";

export const showPlaylistApi = createApi({
  reducerPath: "showPlaylistApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    getShowPlaylist: builder.query<ShowPlaylistWire, { showId: number }>({
      query: ({ showId }) => ({
        url: "/playlist",
        params: { show_id: showId },
      }),
      // An archived show is immutable, so a revisit within the window is served
      // from cache rather than refetched.
      keepUnusedDataFor: 600,
      // The shared base query soft-fails an unparseable body to null, so a
      // transform that assumes a parsed body throws on exactly the responses
      // that soft-fail exists to absorb.
      transformResponse: (response: ShowPlaylistWire | null) =>
        response ?? EMPTY_SHOW_PLAYLIST,
    }),
  }),
});

export const { useGetShowPlaylistQuery } = showPlaylistApi;
