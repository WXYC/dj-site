import { http, HttpResponse } from "msw";
import type { RequestHandler } from "msw";
import { TEST_BACKEND_URL } from "../helpers/constants";

/**
 * MSW handler for `GET /proxy/library/:legacyReleaseId/tracks`.
 *
 * Deliberately NOT added to the base `handlers` set, which is the empty-default
 * base — the repo pattern is a per-spec `server.use`. This lives here so the
 * two specs that need it (`LibraryTrackPicker` and `FlowsheetSearchResults`)
 * share one definition instead of importing across a `.test.tsx`, which has no
 * precedent in this repo.
 *
 * **The path param is a `legacy_release_id`, not a `library.id`.** Backend
 * resolves it via `getDiscogsReleaseIdByLegacyId`, which filters on
 * `library.legacy_release_id`. Stubbing a `library.id` here produces a handler
 * that never matches the request the app actually makes.
 */
export function libraryTracksHandler(
  legacyReleaseId: number,
  tracks: Array<{ position: string; title: string; artist_credit: string }>,
  source: "discogs" | null = "discogs",
): RequestHandler {
  return http.get(
    `${TEST_BACKEND_URL}/proxy/library/${legacyReleaseId}/tracks`,
    () =>
      HttpResponse.json({
        library_id: legacyReleaseId,
        discogs_release_id: source === "discogs" ? 42 : null,
        source,
        tracks: tracks.map((t) => ({ ...t, duration_ms: null })),
      }),
  );
}

/** Convenience single track, for specs that only need the picker to populate. */
export const ONE_TRACK = [
  { position: "A1", title: "la paradoja", artist_credit: "Juana Molina" },
];
