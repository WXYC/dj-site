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

const DEFAULT_LIMIT = 50;

/**
 * The sorts the backend can address by cursor. Every other sort column is
 * non-unique and has no compound `(sort_col, id)` index to support a cursor
 * predicate, so the backend neither emits a cursor under them nor honours one:
 * a cursor sent back under a non-date sort is dropped on intake, page 0 is
 * re-served, the same cursor is re-derived from the same last row, and the walk
 * never advances. Those sorts must stay on offset here.
 */
const CURSOR_PAGINATED_SORTS: ReadonlySet<SortField> = new Set<SortField>([
  "date",
]);

export const isCursorPaginated = (sort: SortField): boolean =>
  CURSOR_PAGINATED_SORTS.has(sort);

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
      infiniteQueryOptions: {
        initialPageParam: FIRST_PAGE,
        getNextPageParam: (
          lastPage,
          _allPages,
          lastPageParam,
          _allPageParams,
          queryArg,
        ) => {
          const { limit = DEFAULT_LIMIT, sort = "date" } = queryArg;

          if (isCursorPaginated(sort)) {
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
          return lastPage.results.length < limit
            ? undefined
            : { cursor: null, page: lastPageParam.page + 1 };
        },
      },
      query({ pageParam, queryArg }) {
        const {
          q,
          limit = DEFAULT_LIMIT,
          sort = "date",
          order = "desc",
        } = queryArg;
        const cursorWalk = isCursorPaginated(sort);

        const params: Record<string, unknown> = {
          q,
          limit,
          sort,
          order,
          page: cursorWalk ? 0 : pageParam.page,
        };
        // Present only on a cursor walk's non-first page — sending cursor=null
        // would serialize as the literal string "null".
        if (cursorWalk && pageParam.cursor !== null) {
          params.cursor = pageParam.cursor;
        }

        return { url: "/search", params };
      },
      transformResponse: (
        response: PlaylistSearchResponseWithCursor | null,
      ): PlaylistSearchResponseWithCursor =>
        response ?? { results: [], total: 0, page: 0, totalPages: 0 },
    }),
  }),
});

export const { useSearchPlaylistsInfiniteQuery } = playlistSearchApi;
