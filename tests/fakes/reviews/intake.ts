import { http, HttpResponse } from "msw";
import type { IntakeItem, IntakeSlip } from "@wxyc/shared";
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
 * - `POST /intake/:id/print` answers the item's entry of `slips`, 409 `not_reviewed` when it has none
 */
export function fakeIntakeEndpoints({ open = [], reviewed = [], awaiting = [], filed = [], records = [], slips = {} }: FakeIntakeOptions = {}) {
  const everyState = () => {
    const byId = new Map<number, IntakeItem>();
    for (const row of [open, reviewed, filed].flatMap(resolve)) byId.set(row.id, row);
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
    http.post(`${BACKEND_URL}/intake/:id/print`, ({ params }) => {
      const slip = slips[Number(params.id)];
      return slip ? HttpResponse.json(slip) : HttpResponse.json({ message: "not reviewed", reason: "not_reviewed" }, { status: 409 });
    }),
  );
}
