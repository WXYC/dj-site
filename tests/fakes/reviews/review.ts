import { http, HttpResponse } from "msw";
import type { Review } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";
import { resolve, type Rows } from "./rows";

export type FakeReviewOptions = {
  mine?: Rows<Review>;
  reviews?: Review[];
  forRelease?: Record<string, Review[]>;
};

/**
 * The `reviews/...` reads:
 *
 * - `GET /reviews?mine=true` answers `mine`
 * - `GET /reviews?album_id=` answers `forRelease[album_id]` (empty when absent)
 * - `GET /reviews/:id` answers the matching row of `reviews`, 404 otherwise
 */
export function fakeReviewEndpoints({ mine = [], reviews = [], forRelease = {} }: FakeReviewOptions = {}) {
  server.use(
    http.get(`${BACKEND_URL}/reviews`, ({ request }) => {
      const albumId = new URL(request.url).searchParams.get("album_id");
      return HttpResponse.json(albumId === null ? resolve(mine) : (forRelease[albumId] ?? []));
    }),
    http.get(`${BACKEND_URL}/reviews/:id`, ({ params }) => {
      const found = reviews.find((row) => String(row.id) === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
  );
}
