import { http, HttpResponse } from "msw";
import type { IntakeItem, IntakeSlip, Reviewer } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";
import { resolve, type Rows } from "./rows";

export type FakeIntakeOptions = {
  open?: Rows<IntakeItem>;
  reviewed?: Rows<IntakeItem>;
  awaiting?: Rows<IntakeItem>;
  filed?: Rows<IntakeItem>;
  records?: IntakeItem[];
  /** The slip `POST /intake/:id/print` answers, by item id. */
  slips?: Record<number, IntakeSlip>;
  /** The accounts a request can name; its answer carries the chosen one's `name`. */
  reviewers?: Reviewer[];
};

/**
 * The `intake/...` reads:
 *
 * - `GET /intake` answers like the server: `awaiting_acceptance=true` ->
 *   `awaiting` (that rule lives on the server). Anything else reads the union
 *   of `open`, `reviewed` and `filed`, de-duplicated by `id` and ordered by
 *   `logged_at` descending then `id` descending, so an unfiltered read carries
 *   every state; `state=` filters that union by each row's `effective_state`.
 *   A row's lane is its `effective_state`, whichever option it was passed in.
 * - `GET /intake/:id` answers the matching row of `records`, 404 otherwise
 *
 * and the `intake/...` writes:
 *
 * - `POST /intake/:id/request` answers the matching row of the unfiltered union,
 *   requested of the `dj_id` sent (named from `reviewers`), 404 otherwise.
 * - `POST /intake/:id/cancel-request` answers the matching row of the unfiltered
 *   union, back in the `pool` state with no requested DJ, 404 otherwise.
 *
 *   Both writes keep one overlay per id, which later reads apply, so a screen
 *   sees the row move between lanes and a row requested then cancelled reads
 *   back on the review shelf. A spec for a 409 layers its own handler.
 * - `POST /intake/:id/print` answers the item's entry of `slips`, 409 `not_reviewed` when it has none
 */
export function fakeIntakeEndpoints({ open = [], reviewed = [], awaiting = [], filed = [], records = [], slips = {}, reviewers = [] }: FakeIntakeOptions = {}) {
  const overlay = new Map<number, (row: IntakeItem) => IntakeItem>();
  const unrequested = (row: IntakeItem): IntakeItem =>
    ({ ...row, state: "pool", effective_state: "pool", requested_dj_id: null, requested_dj_name: null, requested_at: null }) as IntakeItem;
  const requestedOf = (djId: string) => (row: IntakeItem): IntakeItem =>
    ({
      ...row,
      state: "requested",
      effective_state: "requested",
      requested_dj_id: djId,
      requested_dj_name: reviewers.find((r) => r.id === djId)?.name ?? null,
      requested_at: "2026-09-02T12:00:00Z",
    }) as IntakeItem;
  const everyState = () => {
    const byId = new Map<number, IntakeItem>();
    for (const row of [open, reviewed, filed].flatMap(resolve)) byId.set(row.id, overlay.get(row.id)?.(row) ?? row);
    return [...byId.values()].sort((a, b) => b.logged_at.localeCompare(a.logged_at) || b.id - a.id);
  };
  server.use(
    http.get(`${BACKEND_URL}/intake`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.get("awaiting_acceptance") === "true") return HttpResponse.json(resolve(awaiting));
      const state = query.get("state");
      return HttpResponse.json(everyState().filter((row) => !state || row.effective_state === state));
    }),
    http.get(`${BACKEND_URL}/intake/:id`, ({ params }) => {
      const found = records.find((row) => String(row.id) === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
    http.post(`${BACKEND_URL}/intake/:id/cancel-request`, ({ params }) => {
      const found = everyState().find((row) => String(row.id) === params.id);
      if (!found) return HttpResponse.json({ message: "not found" }, { status: 404 });
      overlay.set(found.id, unrequested);
      return HttpResponse.json(unrequested(found));
    }),
    http.post(`${BACKEND_URL}/intake/:id/request`, async ({ params, request }) => {
      const found = everyState().find((row) => String(row.id) === params.id);
      if (!found) return HttpResponse.json({ message: "not found" }, { status: 404 });
      const { dj_id } = (await request.json()) as { dj_id: string };
      overlay.set(found.id, requestedOf(dj_id));
      return HttpResponse.json(requestedOf(dj_id)(found));
    }),
    http.post(`${BACKEND_URL}/intake/:id/print`, ({ params }) => {
      const slip = slips[Number(params.id)];
      return slip ? HttpResponse.json(slip) : HttpResponse.json({ message: "not reviewed", reason: "not_reviewed" }, { status: 409 });
    }),
  );
}
