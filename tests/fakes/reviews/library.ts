import { http, HttpResponse } from "msw";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

export type FakeLibraryOptions = {
  releases?: { id: number; [key: string]: unknown }[];
  formats?: { id: number; format_name: string }[];
  /** The raw rows a catalog search (`GET /library?artist_name=&album_title=&n=`) answers, whatever the term. */
  searchResults?: { id: number; [key: string]: unknown }[];
};

/**
 * The catalog lookups the reviews screens make:
 *
 * - `GET /library/info?album_id=` answers the matching row of `releases` (the
 *   raw wire shape), 404 otherwise
 * - `GET /library/formats` answers `formats` (one `cd` format by default)
 * - `GET /library` with `artist_name` and `album_title` (the release picker's search) answers `searchResults`,
 *   empty by default; a read without both is left to the next handler
 */
export function fakeLibraryLookupEndpoints({ releases = [], formats = [{ id: 1, format_name: "cd" }], searchResults = [] }: FakeLibraryOptions = {}) {
  server.use(
    http.get(`${BACKEND_URL}/library`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      return params.has("artist_name") && params.has("album_title") ? HttpResponse.json(searchResults) : undefined;
    }),
    http.get(`${BACKEND_URL}/library/info`, ({ request }) => {
      const id = new URL(request.url).searchParams.get("album_id");
      const found = releases.find((row) => String(row.id) === id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ message: "not found" }, { status: 404 });
    }),
    http.get(`${BACKEND_URL}/library/formats`, () => HttpResponse.json(formats)),
  );
}
