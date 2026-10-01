import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import type { FlowsheetV2Entry, FlowsheetRangeResponse } from "@wxyc/shared";
import { archiveStreamApi } from "@/lib/features/archive-stream/api";
import { TEST_BACKEND_URL } from "../helpers/constants";
import { server } from "./server";

/**
 * MSW handlers for `GET /flowsheet/range` that reproduce the endpoint's own
 * window semantics rather than a single canned page, so the archive-stream
 * specs can't drift from the route they're pinning. `serveArchive` returns
 * every row in the half-open window `[start, end)`, oldest first.
 * `rangeRejection` answers the route's own 400s in the route's own order, so
 * that a fake that is laxer than the route can't hide a request the route
 * would reject.
 *
 * Deliberately not part of the base `handlers` set: `serveArchive` and
 * `queueRangeResponses` each install their own `server.use` handler for
 * `/flowsheet/range` when a spec calls them, rather than exporting one for a
 * spec to pass to `server.use` itself.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_WINDOW_MS = 8 * DAY_MS;
// The instants where `Date#toISOString` changes form, outside which the
// backend refuses an epoch-millisecond param.
const MIN_EPOCH_MS = -62167219200000;
const MAX_EPOCH_MS = 253402300799999;

export const EMPTY_PAGE: FlowsheetRangeResponse = { shows: [], entries: [] };

/** A requested `/flowsheet/range` window, with the raw params it was sent as. */
export type RangeWindow = { start: number; end: number; params: URLSearchParams };

export function rangeEntry(id: number, at?: number): FlowsheetV2Entry {
  return {
    id,
    play_order: id,
    show_id: 1,
    request_flag: false,
    entry_type: "track",
    add_time: new Date(at ?? 0).toISOString(),
  };
}

export function archiveStreamStore() {
  return configureStore({
    reducer: { [archiveStreamApi.reducerPath]: archiveStreamApi.reducer },
    middleware: (gdm) => gdm().concat(archiveStreamApi.middleware),
  });
}

function captureWindow(request: Request, windows: RangeWindow[]): RangeWindow {
  const params = new URL(request.url).searchParams;
  const requested = { start: Number(params.get("start")), end: Number(params.get("end")), params };
  windows.push(requested);
  return requested;
}

const parseEpochMillis = (raw: string | null): number | null => {
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= MIN_EPOCH_MS && value <= MAX_EPOCH_MS ? value : null;
};

/**
 * The 400 that `/flowsheet/range` answers for a window it refuses, or `null`
 * for one it serves -- the same checks in the same order as Backend-Service's
 * `getEntriesInRange`, so a fake that is laxer than the route can't hide a
 * request the route would reject.
 */
export function rangeRejection({ params }: RangeWindow): Response | null {
  const badRequest = (message: string) => HttpResponse.json({ message }, { status: 400 });
  const start = parseEpochMillis(params.get("start"));
  if (start === null) return badRequest("start must be an integer number of epoch milliseconds");
  const end = parseEpochMillis(params.get("end"));
  if (end === null) return badRequest("end must be an integer number of epoch milliseconds");
  if (end <= start) return badRequest("end must be strictly greater than start");
  if (end - start > MAX_WINDOW_MS) return badRequest("window must not exceed 8 days");
  return null;
}

/**
 * A row to serve from the fake archive: either the `{ id, at }` shorthand,
 * which the fake expands to a track entry, or a ready-made contract entry of
 * any type, served as given.
 */
export type ArchiveRow = { id: number; at: number } | FlowsheetV2Entry;

function toEntry(row: ArchiveRow): FlowsheetV2Entry {
  return "entry_type" in row ? row : rangeEntry(row.id, row.at);
}

function atOf(row: ArchiveRow): number {
  return "entry_type" in row ? Date.parse(row.add_time) : row.at;
}

/**
 * A fake archive that answers the way the backend does: every row whose
 * `add_time` falls in the half-open window `[start, end)`, oldest first.
 * Returns the requested windows in call order.
 */
export function serveArchive(rows: ArchiveRow[]): RangeWindow[] {
  const windows: RangeWindow[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
      const requested = captureWindow(request, windows);
      const rejection = rangeRejection(requested);
      if (rejection) return rejection;
      const { start, end } = requested;
      const entries = rows
        .filter((row) => atOf(row) >= start && atOf(row) < end)
        .sort((a, b) => atOf(a) - atOf(b) || a.id - b.id)
        .map(toEntry);
      return HttpResponse.json({ shows: [], entries });
    }),
  );
  return windows;
}

/**
 * Serves `bodies` in order, one per request, repeating the final one once
 * exhausted. Returns the requested windows in call order.
 */
export function queueRangeResponses(bodies: (() => Response)[]): RangeWindow[] {
  const windows: RangeWindow[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
      const body = bodies[Math.min(windows.length, bodies.length - 1)];
      return rangeRejection(captureWindow(request, windows)) ?? body();
    }),
  );
  return windows;
}
