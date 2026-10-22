import { http, HttpResponse } from "msw";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

/**
 * The Backend's answer to `GET /feature-access` for the reviews feature: an entry, or an HTTP status for a refusal. The
 * default handler in `handlers.ts` answers `everyone` and can see, so a spec that does not care about the gate needs nothing.
 */
export function fakeReviewsAccess(answer: { audience: string; can_see: boolean } | number) {
  server.use(
    http.get(`${BACKEND_URL}/feature-access`, () =>
      typeof answer === "number" ? HttpResponse.json({ message: "refused" }, { status: answer }) : HttpResponse.json({ reviews: answer }),
    ),
  );
}
