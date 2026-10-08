import { http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";
import { resolve, type Rows } from "./rows";

export type FakeIntakeOptions = {
  open?: Rows<IntakeItem>;
  reviewed?: Rows<IntakeItem>;
  awaiting?: Rows<IntakeItem>;
  filed?: Rows<IntakeItem>;
  records?: IntakeItem[];
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
 */
export function fakeIntakeEndpoints({ open = [], reviewed = [], awaiting = [], filed = [], records = [] }: FakeIntakeOptions = {}) {
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
  );
}
