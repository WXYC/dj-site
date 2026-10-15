import { http, HttpResponse } from "msw";
import type { AlbumReview } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

export type FakeAlbumReviewOptions = {
  archive?: Record<string, AlbumReview[]>;
  byArtist?: Record<string, AlbumReview[]>;
};

/** The server's exact artist match: capitals and a leading "The" don't matter, and surrounding whitespace is not trimmed ("Stereolab " matches nothing). */
const artistKey = (name: string) => name.toLowerCase().replace(/^the\s+/, "");

/**
 * `GET /album-reviews?album_id=` answers `archive[album_id]` and `?artist=` answers the `byArtist` entry whose name
 * matches exactly, both as the archive page shape; a blank artist is a 400, as on the server. A read with neither answers an empty page.
 */
export function fakeAlbumReviewEndpoints({ archive = {}, byArtist = {} }: FakeAlbumReviewOptions = {}) {
  server.use(
    http.get(`${BACKEND_URL}/album-reviews`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const artist = params.get("artist");
      if (artist !== null && artist.trim() === "") {
        return HttpResponse.json({ message: "artist must not be blank" }, { status: 400 });
      }
      const rows =
        artist !== null
          ? Object.entries(byArtist).filter(([name]) => artistKey(name) === artistKey(artist)).flatMap(([, reviews]) => reviews)
          : (archive[params.get("album_id") ?? ""] ?? []);
      return HttpResponse.json({ album_reviews: rows, pagination: {} });
    }),
  );
}
