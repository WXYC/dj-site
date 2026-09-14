import { http, HttpResponse } from "msw";
import { server } from "./server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../helpers/constants";
import type { DiscogsReleasePrefill } from "@/lib/features/catalog/types";

/** The fixture release the bench's autopopulate resolves to by default. */
export const MOLINA_DISCOGS_PREFILL: DiscogsReleasePrefill = {
  discogs_release_id: 24216789,
  discogs_master_id: null,
  artist_name: "Juana Molina",
  album_title: "DOGA",
  label: "Sonamos",
  label_id: null,
  year: 2022,
  discogs_artist_id: null,
  genres: ["Rock"],
  styles: [],
  artwork_url: null,
};

/**
 * A gateway/edge HTML error page (Cloudflare 502/504/524, nginx/ALB 5xx) or
 * Express's default HTML 404 for a route not yet deployed to a preview/staging
 * env — the non-JSON hard-failure shape a BS->LML proxy really produces. The
 * JSON base query soft-fails such a body into a successful `null` payload
 * unless the endpoint opts out with `surfaceNonJsonAsError`, so this is what
 * exercises that opt-out. Return it from `respond` to drive the path.
 */
export function discogsPrefillGatewayHtml(status = 502): Response {
  return new HttpResponse(
    `<!DOCTYPE html><html><head><title>${status}</title></head>` +
      `<body><h1>${status}</h1><p>The server returned an error.</p></body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  );
}

/**
 * Stand-in for `GET /library/releases/discogs-prefill?url=` — Backend-Service
 * resolves a pasted Discogs release link (or bare id) to the bench's prefill
 * fields via LML. By default a `discogs.com/release/<id>` link (or a bare
 * numeric id) resolves to `prefill`; anything else is refused with the
 * endpoint's named 400 (`not_release_url`), the inline-and-non-blocking failure
 * the bench renders.
 *
 * `respond` overrides the whole answer for a given `url` — return a named 4xx
 * there to exercise a specific refusal (`release_not_found`, `master_url`, …),
 * a non-JSON body via `discogsPrefillGatewayHtml` to exercise the hard-failure
 * path, or `undefined` to fall through to the default resolve.
 */
export function fakeDiscogsPrefillEndpoint(
  options: {
    prefill?: DiscogsReleasePrefill;
    respond?: (url: string) => Response | undefined;
  } = {},
) {
  const prefill = options.prefill ?? MOLINA_DISCOGS_PREFILL;
  const urls: string[] = [];

  server.use(
    http.get(`${BACKEND_URL}/library/releases/discogs-prefill`, ({ request }) => {
      const url = new URL(request.url).searchParams.get("url") ?? "";
      urls.push(url);

      const override = options.respond?.(url);
      if (override) return override;

      const resolvable =
        /^\d+$/.test(url.trim()) || /discogs\.com\/release\/\d+/i.test(url);
      if (!resolvable) {
        return HttpResponse.json(
          { message: "Not a Discogs release URL", code: "not_release_url" },
          { status: 400 },
        );
      }
      return HttpResponse.json(prefill, { status: 200 });
    }),
  );

  return { urls: () => [...urls] };
}
