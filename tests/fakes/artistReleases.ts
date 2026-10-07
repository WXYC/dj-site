import { http, HttpResponse, delay } from "msw";
import { server } from "./server";
import { TEST_BACKEND_URL } from "../helpers/constants";

/**
 * Stand-in for `GET /library/artists/:id/releases`, paged the way Backend
 * pages it: `page` is 0-based, `limit` defaults to 50, the rows are the
 * `page`-th slice of `releases`, and `totalPages` is `ceil(total / limit)`
 * (so an empty shelf reports 0 pages, not 1).
 *
 * `total` defaults to `releases.length`; pass a larger one to model a server
 * that reports more rows than it serves. `failPages` answers those pages with
 * a 500. Pass `concurrency` to have each response held for a few
 * milliseconds and the most requests ever in flight at once recorded in
 * `concurrency.peak`. Returns the query params of every request, in arrival
 * order, for assertions on what the client asked for.
 */
export function serveArtistReleasePages(
  artistId: number,
  releases: readonly unknown[],
  {
    total = releases.length,
    failPages = [],
    concurrency,
  }: {
    total?: number;
    failPages?: number[];
    concurrency?: { inFlight: number; peak: number };
  } = {},
): URLSearchParams[] {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/${artistId}/releases`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      if (concurrency) {
        concurrency.inFlight += 1;
        concurrency.peak = Math.max(concurrency.peak, concurrency.inFlight);
        await delay(5);
        concurrency.inFlight -= 1;
      }
      const page = Number(params.get("page") ?? 0);
      const limit = Number(params.get("limit") ?? 50);
      if (failPages.includes(page)) {
        return HttpResponse.json({ message: "boom" }, { status: 500 });
      }
      return HttpResponse.json({
        artist_id: artistId,
        releases: releases.slice(page * limit, (page + 1) * limit),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }),
  );
  return requests;
}
