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
 * Stand-in for `GET /library/releases/discogs-prefill?url=` — Backend-Service
 * resolves a pasted Discogs release link (or bare id) to the bench's prefill
 * fields via LML. By default a `discogs.com/release/<id>` link (or a bare
 * numeric id) resolves to `prefill`; anything else is refused with the
 * endpoint's named 400 (`not_release_url`), the inline-and-non-blocking failure
 * the bench renders.
 *
 * `respond` overrides the whole answer for a given `url` — return a named 4xx
 * there to exercise a specific refusal (`release_not_found`, `master_url`, …),
 * or `undefined` to fall through to the default resolve.
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
