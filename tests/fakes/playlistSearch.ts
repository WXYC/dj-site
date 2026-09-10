import { http, HttpResponse } from "msw";
import type { RequestHandler } from "msw";
import type { PlaylistSearchResult } from "@wxyc/shared";
import type { PlaylistSearchResponseWithCursor } from "@/lib/features/playlist-search/api";
import { TEST_BACKEND_URL } from "../helpers/constants";

/**
 * MSW handler for `GET /flowsheet/search` that reproduces the endpoint's two
 * pagination modes rather than a single canned page.
 *
 * The backend answers `sort=date` with an opaque `nextCursor` and answers every
 * other sort by `page` offset — those sort columns are not unique and have no
 * compound `(sort_col, id)` index, so a cursor is neither emitted nor honoured
 * under them. A fake that always emits a cursor, or always answers the offset,
 * cannot tell a client that picks the right mode from one that doesn't.
 *
 * Deliberately not part of the base `handlers` set, which is the empty-default
 * base; specs opt in with `server.use`.
 */

const ARCHIVE_TRACKS: ReadonlyArray<
  Pick<
    PlaylistSearchResult,
    "artist_name" | "track_title" | "album_title" | "record_label"
  >
> = [
  {
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
  },
  {
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
  },
  {
    artist_name: "Chuquimamani-Condori",
    track_title: "Call Your Name",
    album_title: "Edits",
    record_label: "self-released",
  },
  {
    artist_name: "Duke Ellington & John Coltrane",
    track_title: "In a Sentimental Mood",
    album_title: "Duke Ellington & John Coltrane",
    record_label: "Impulse Records",
  },
  {
    artist_name: "Stereolab",
    track_title: "Ping Pong",
    album_title: "Mars Audiac Quintet",
    record_label: "Duophonic",
  },
  {
    artist_name: "Cat Power",
    track_title: "The Greatest",
    album_title: "The Greatest",
    record_label: "Matador",
  },
];

const FIRST_ROW_ID = 10_000;
const ARCHIVE_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

function buildArchive(size: number): PlaylistSearchResult[] {
  return Array.from({ length: size }, (_, index) => ({
    id: FIRST_ROW_ID + index,
    play_date: new Date(ARCHIVE_EPOCH_MS - index * 60_000).toISOString(),
    ...ARCHIVE_TRACKS[index % ARCHIVE_TRACKS.length],
    dj_name: `DJ ${index % 4}`,
    show_id: 1 + Math.floor(index / 20),
  }));
}

/** Mirrors the real cursor's shape: opaque to the client, derived from the last row served. */
const encodeCursor = (lastRowId: number) => `after:${lastRowId}`;
const decodeCursor = (cursor: string) => Number(cursor.slice("after:".length));

export type PlaylistSearchFakeRequest = {
  q: string;
  sort: string;
  order: string;
  page: number;
  limit: number;
  cursor: string | null;
};

export type PlaylistSearchFake = {
  handler: RequestHandler;
  /** Every request the fake served, oldest first, as the client sent it. */
  requests: PlaylistSearchFakeRequest[];
  rows: PlaylistSearchResult[];
};

export type PlaylistSearchFakeOptions = {
  /** How many rows the archive actually holds — the real end of the walk. */
  archiveSize: number;
  /**
   * `total` to report, when it should differ from `archiveSize`. The real
   * endpoint caps its count at 10000 and reports 10001 as a "10000+" sentinel,
   * so the derived `totalPages` is a lower bound and a client that treats it as
   * exact stops early.
   */
  reportedTotal?: number;
  /**
   * Emit `nextCursor` under every sort, not just `date` — the leak the backend's
   * sort gate exists to prevent. A client that sends such a cursor back gets it
   * dropped on intake and re-served the same page forever.
   */
  emitCursorForEverySort?: boolean;
};

export function playlistSearchFake({
  archiveSize,
  reportedTotal,
  emitCursorForEverySort = false,
}: PlaylistSearchFakeOptions): PlaylistSearchFake {
  const rows = buildArchive(archiveSize);
  const requests: PlaylistSearchFakeRequest[] = [];

  const handler = http.get(`${TEST_BACKEND_URL}/flowsheet/search`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const sort = params.get("sort") ?? "date";
    const limit = Number(params.get("limit") ?? 50);
    const page = Number(params.get("page") ?? 0);
    const cursor = params.get("cursor");

    requests.push({
      q: params.get("q") ?? "",
      sort,
      order: params.get("order") ?? "desc",
      page,
      limit,
      cursor,
    });

    const cursorEligible = emitCursorForEverySort || sort === "date";
    const offset =
      cursorEligible && cursor !== null
        ? rows.findIndex((row) => row.id === decodeCursor(cursor)) + 1
        : page * limit;

    const results = rows.slice(offset, offset + limit);
    const total = reportedTotal ?? rows.length;
    // Typed against the client's own response shape, so a drift in the wire
    // contract fails to compile here rather than passing a spec on a body the
    // endpoint no longer sends.
    const body: PlaylistSearchResponseWithCursor = {
      results,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      ...(cursorEligible && results.length === limit
        ? { nextCursor: encodeCursor(results[results.length - 1].id) }
        : {}),
    };

    return HttpResponse.json(body);
  });

  return { handler, requests, rows };
}
