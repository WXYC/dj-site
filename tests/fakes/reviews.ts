import { http, HttpResponse } from "msw";
import type { IntakeItem, Review } from "@wxyc/shared";
import { server } from "./server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../helpers/constants";

/** An intake record on the review shelf, with WXYC-representative data. */
export const intakeItem = (overrides: Partial<IntakeItem> = {}): IntakeItem =>
  ({
    id: 1,
    artist_name: "Stereolab",
    album_title: "Aluminum Tunes",
    record_label: "Duophonic",
    format_id: 1,
    state: "pool",
    effective_state: "pool",
    overdue: false,
    logged_at: "2026-09-01T12:00:00Z",
    requested_dj_id: null,
    requested_at: null,
    checked_out_by: null,
    checked_out_at: null,
    ...overrides,
  }) as IntakeItem;

/** A draft review of the record `intakeItem()` describes. */
export const review = (overrides: Partial<Review> = {}): Review =>
  ({
    id: 40,
    intake_item_id: 2,
    album_id: null,
    author: "DJ Me",
    add_date: "2026-10-07",
    status: "draft",
    buzzwords: null,
    artist_blurb: null,
    review: "Warm.",
    recommended_tracks: null,
    fcc: null,
    ...overrides,
  }) as Review;

/** A list given as rows, or as a function so a spec can change the answer over time. */
type Rows<Row> = Row[] | (() => Row[]);
const resolve = <Row>(rows: Rows<Row>) => (typeof rows === "function" ? rows() : rows);

/**
 * Stand-in for every GET the reviews screen and the review editor make, so a
 * spec that renders either one cannot fall through to the network (MSW
 * bypasses unhandled requests, and a missing read shows up as the component's
 * load-failure line):
 *
 * - `GET /intake` answers `awaiting` when `awaiting_acceptance=true`, else `reviewed`
 *   when `state=reviewed`, `filed` when `state=filed`, else `open`
 * - `GET /reviews?mine=true` answers `mine`
 * - `GET /reviews/:id` answers the matching row of `reviews`, 404 otherwise
 * - `GET /intake/:id` answers the matching row of `records`, 404 otherwise
 * - `GET /library/info?album_id=` answers the matching row of `releases` (the
 *   raw wire shape), 404 otherwise
 * - `GET /library/formats` answers `formats` (one `cd` format by default)
 *
 * Lists default to empty. A spec that holds, counts or fails a read layers its
 * own `server.use(...)` over these defaults. When the screen or the editor
 * gains a read, add its default here so no other spec has to learn about it.
 */
export function fakeReviewsEndpoints({
  open = [],
  reviewed = [],
  awaiting = [],
  filed = [],
  mine = [],
  reviews = [],
  records = [],
  releases = [],
  formats = [{ id: 1, format_name: "cd" }],
}: {
  open?: Rows<IntakeItem>;
  reviewed?: Rows<IntakeItem>;
  awaiting?: Rows<IntakeItem>;
  filed?: Rows<IntakeItem>;
  mine?: Rows<Review>;
  reviews?: Review[];
  records?: IntakeItem[];
  releases?: { id: number; [key: string]: unknown }[];
  formats?: { id: number; format_name: string }[];
} = {}) {
  server.use(
    http.get(`${BACKEND_URL}/intake`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.get("awaiting_acceptance") === "true") return HttpResponse.json(resolve(awaiting));
      const byState = { reviewed, filed };
      return HttpResponse.json(resolve(byState[query.get("state") as keyof typeof byState] ?? open));
    }),
    http.get(`${BACKEND_URL}/reviews`, () => HttpResponse.json(resolve(mine))),
    http.get(`${BACKEND_URL}/reviews/:id`, ({ params }) => {
      const found = reviews.find((row) => String(row.id) === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
    http.get(`${BACKEND_URL}/intake/:id`, ({ params }) => {
      const found = records.find((row) => String(row.id) === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
    http.get(`${BACKEND_URL}/library/info`, ({ request }) => {
      const id = new URL(request.url).searchParams.get("album_id");
      const found = releases.find((row) => String(row.id) === id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
    http.get(`${BACKEND_URL}/library/formats`, () => HttpResponse.json(formats)),
  );
}
