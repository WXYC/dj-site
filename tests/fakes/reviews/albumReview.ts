import { http, HttpResponse } from "msw";
import type { AlbumReview } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

export type FakeAlbumReviewOptions = {
  archive?: Record<string, AlbumReview[]>;
};

/** `GET /album-reviews?album_id=` answers `archive[album_id]` as the archive page shape. */
export function fakeAlbumReviewEndpoints({ archive = {} }: FakeAlbumReviewOptions = {}) {
  server.use(
    http.get(`${BACKEND_URL}/album-reviews`, ({ request }) => {
      const albumId = new URL(request.url).searchParams.get("album_id") ?? "";
      return HttpResponse.json({ album_reviews: archive[albumId] ?? [], pagination: {} });
    }),
  );
}
