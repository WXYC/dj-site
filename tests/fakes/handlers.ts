import { http, HttpResponse } from "msw";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Base handlers that can be extended in individual tests
export const handlers = [
  // Catalog API handlers
  http.get(`${BACKEND_URL}/library/`, ({ request }) => {
    const url = new URL(request.url);
    const artistName = url.searchParams.get("artist_name");
    const albumName = url.searchParams.get("album_title");

    // Return empty array by default - tests can override with specific handlers
    return HttpResponse.json([]);
  }),

  http.get(`${BACKEND_URL}/library/query`, () => {
    return HttpResponse.json({ results: [], total: 0, page: 0, totalPages: 0 });
  }),

  http.get(`${BACKEND_URL}/library/info`, () => {
    return HttpResponse.json({});
  }),

  http.get(`${BACKEND_URL}/library/formats`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BACKEND_URL}/library/genres`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BACKEND_URL}/library/artists/:id/next-release-number`, () => {
    return HttpResponse.json({ next_code_number: 1 });
  }),

  // Authentication API handlers
  http.get(`${BACKEND_URL}/authentication/`, () => {
    return HttpResponse.json({ message: "Not Authenticated" });
  }),

  // better-auth JWT token endpoint. `AuthorizedView` fires `getJWTToken()` from
  // an effect on any `userId` (via `fetchOrganizationRoleForUserClient`), and
  // the auth base is `${window.location.origin}/auth` in jsdom — not
  // `BACKEND_URL` — so without this handler the request bypasses MSW
  // (`onUnhandledRequest: "bypass"`) and hits the dead network. The fire-and-
  // forget rejection then lands after test teardown and flakes whole shards
  // ("Failed to get JWT token: fetch failed"), all tests still passing.
  // `{ token: null }` is behaviour-preserving: with no token and no
  // NEXT_PUBLIC_APP_ORGANIZATION set in tests, the role lookup returns
  // undefined (no listMembers fallback) and AuthorizedView fails closed to
  // Authorization.NO — exactly as it does today when the real fetch fails.
  // Regex-matched by any origin. Tests exercising real auth mock
  // organization-utils/getJWTToken per-file and never reach here. (dj-site#1646)
  http.get(/\/auth\/token$/, () => HttpResponse.json({ token: null })),

  // Flowsheet API handlers
  http.get(`${BACKEND_URL}/flowsheet/`, () => {
    return HttpResponse.json([]);
  }),

  // The open-shows table reads total_in_window for its truncation notice, so
  // the default fake carries the full object shape, never a bare [].
  http.get(`${BACKEND_URL}/flowsheet/open-shows`, () => {
    return HttpResponse.json({
      shows: [],
      total_in_window: 0,
      older_open_show_count: 0,
    });
  }),

  // Playlist search API handlers
  http.get(`${BACKEND_URL}/flowsheet/playlist`, () => {
    return HttpResponse.json({
      id: 0,
      show_name: null,
      specialty_show_name: "",
      start_time: "",
      end_time: null,
      show_djs: [],
      previous_show_id: null,
      next_show_id: null,
      entries: [],
    });
  }),

  http.get(`${BACKEND_URL}/flowsheet/search`, () => {
    return HttpResponse.json({ results: [], total: 0, page: 0, totalPages: 0 });
  }),

  // Rotation API handlers
  http.get(`${BACKEND_URL}/rotation/`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BACKEND_URL}/library/rotation`, () => {
    return HttpResponse.json([]);
  }),

  // LML artwork handler (matches any origin since LML URL is configurable)
  http.post(/\/api\/v1\/discogs\/search/, () => {
    return HttpResponse.json({ results: [], total: 0, cached: false });
  }),

  // LML library search handler
  http.get(/\/api\/v1\/library\/search/, () => {
    return HttpResponse.json({ results: [], total: 0, query: null });
  }),
];
