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
 * - `GET /intake` answers the first row of the query table that matches
 *   (`awaiting_acceptance=true` -> `awaiting`, `state=reviewed` -> `reviewed`,
 *   `state=filed` -> `filed`), else `open`. A new filter is a new row.
 * - `GET /intake/:id` answers the matching row of `records`, 404 otherwise
 */
export function fakeIntakeEndpoints({ open = [], reviewed = [], awaiting = [], filed = [], records = [] }: FakeIntakeOptions = {}) {
  const queryTable: [param: string, value: string, rows: Rows<IntakeItem>][] = [
    ["awaiting_acceptance", "true", awaiting],
    ["state", "reviewed", reviewed],
    ["state", "filed", filed],
  ];
  server.use(
    http.get(`${BACKEND_URL}/intake`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const hit = queryTable.find(([param, value]) => query.get(param) === value);
      return HttpResponse.json(resolve(hit ? hit[2] : open));
    }),
    http.get(`${BACKEND_URL}/intake/:id`, ({ params }) => {
      const found = records.find((row) => String(row.id) === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
  );
}
