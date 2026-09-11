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

type SortField = PlaylistSearchParams["sort"];

/**
 * Which sorts the backend can address by cursor. Every other sort column is
 * non-unique and has no compound `(sort_col, id)` index to support a cursor
 * predicate, so the backend neither emits a cursor under them nor honours one:
 * a cursor sent back under a non-date sort is dropped on intake, page 0 is
 * re-served, the same cursor is re-derived from the same last row, and the walk
 * never advances. Those sorts must stay on offset here.
 *
 * Total over `SortField` rather than a membership test, so a sort added to the
 * union upstream fails to compile here instead of silently inheriting offset.
 */
const CURSOR_PAGINATED: Record<SortField, boolean> = {
  date: true,
  artist: false,
  song: false,
  dj: false,
};

export const isCursorPaginated = (sort: SortField): boolean =>
  CURSOR_PAGINATED[sort];

/**
 * Both halves of a walk's position, travelling as one value so nothing can
 * reset half of it. Exactly one half is live per request, chosen by sort.
 */
type PlaylistSearchPageParam = {
  cursor: string | null;
  page: number;
};

const FIRST_PAGE: PlaylistSearchPageParam = { cursor: null, page: 0 };

export const playlistSearchApi = createApi({
  reducerPath: "playlistSearchApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    searchPlaylists: builder.infiniteQuery<
      PlaylistSearchResponseWithCursor,
      PlaylistSearchInfiniteArg,
      PlaylistSearchPageParam
    >({
      // The accumulated walk is held for exactly as long as the playlists
      // screen is open, by usePlaylistSearchSubscription sitting above that
      // screen's show/listing branch. Retention past the last unsubscribe would
      // therefore only ever outlive the screen itself — and an entry that
      // outlives its screen is one the next arrival can be served stale, or one
      // a forced refetch re-walks page by page. Zero makes leaving the screen
      // drop the pages, so the next arrival fetches a genuinely fresh page 1.
      keepUnusedDataFor: 0,
      infiniteQueryOptions: {
        initialPageParam: FIRST_PAGE,
        getNextPageParam: (
          lastPage,
          _allPages,
          lastPageParam,
          _allPageParams,
          queryArg,
        ) => {
          if (isCursorPaginated(queryArg.sort)) {
            return lastPage.nextCursor
              ? { cursor: lastPage.nextCursor, page: 0 }
              : undefined;
          }

          // A full page is the only evidence of more rows an offset walk gets.
          // `totalPages` derives from a count the backend caps, which makes it
          // a lower bound: it can say "keep going" but never "stop", so a walk
          // that terminated on it would cut the tail off every large result
          // set. A short page is exact, at the cost of one empty request when
          // the set divides evenly into pages.
          return lastPage.results.length < queryArg.limit
            ? undefined
            : { cursor: null, page: lastPageParam.page + 1 };
        },
      },
      query({ pageParam, queryArg }) {
        const { q, limit, sort, order } = queryArg;

        return {
          url: "/search",
          params: {
            q,
            limit,
            sort,
            order,
            page: pageParam.page,
            // Present only on a cursor walk's non-first page — sending
            // cursor=null would serialize as the literal string "null".
            ...(isCursorPaginated(sort) && pageParam.cursor !== null
              ? { cursor: pageParam.cursor }
              : {}),
          },
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
