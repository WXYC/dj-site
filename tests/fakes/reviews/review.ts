import { http, HttpResponse } from "msw";
import type { Review, ReviewRevision, Reviewer } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";
import { resolve, type Rows } from "./rows";

export type FakeReviewOptions = {
  mine?: Rows<Review>;
  reviews?: Review[];
  forRelease?: Record<string, Review[]>;
  forItem?: Record<string, Review[]>;
  revisions?: Record<string, ReviewRevision[]>;
  /** The accounts `GET /reviews/reviewers` lists. */
  reviewers?: Reviewer[];
};

/**
 * The `reviews/...` reads:
 *
 * - `GET /reviews?album_id=` answers `forRelease[album_id]` (empty when absent)
 * - `GET /reviews?intake_item_id=` answers `forItem[intake_item_id]` (empty when absent)
 * - `GET /reviews?mine=true` answers `mine`
 * - any other `GET /reviews` query answers an empty list, never `mine`
 * - `GET /reviews/reviewers` answers `{ reviewers }` (empty when absent); registered before `GET /reviews/:id`, which would otherwise take the segment
 * - `GET /reviews/:id` answers the matching row of `reviews`, 404 otherwise
 * - `GET /reviews/:id/revisions` answers `revisions[id]` (empty when absent), in the order given
 */
export function fakeReviewEndpoints({ mine = [], reviews = [], forRelease = {}, forItem = {}, revisions = {}, reviewers = [] }: FakeReviewOptions = {}) {
  server.use(
    http.get(`${BACKEND_URL}/reviews`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const albumId = query.get("album_id");
      const itemId = query.get("intake_item_id");
      if (albumId !== null) return HttpResponse.json(forRelease[albumId] ?? []);
      if (itemId !== null) return HttpResponse.json(forItem[itemId] ?? []);
      return HttpResponse.json(query.get("mine") === "true" ? resolve(mine) : []);
    }),
    http.get(`${BACKEND_URL}/reviews/reviewers`, () => HttpResponse.json({ reviewers })),
    http.get(`${BACKEND_URL}/reviews/:id`, ({ params }) => {
      const found = reviews.find((row) => String(row.id) === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
    http.get(`${BACKEND_URL}/reviews/:id/revisions`, ({ params }) => HttpResponse.json(revisions[String(params.id)] ?? [])),
  );
}
