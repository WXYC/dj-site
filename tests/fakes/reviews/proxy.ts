import { http, HttpResponse } from "msw";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

export type FakeProxyOptions = {
  /** The cover every album read answers; none by default, so a row keeps its format glyph. */
  artworkUrl?: string | null;
};

/**
 * The `proxy/...` reads the review rows make:
 *
 * - `GET /proxy/metadata/album` answers `{ artworkUrl }` for any artist and title
 */
export function fakeProxyEndpoints({ artworkUrl = null }: FakeProxyOptions = {}) {
  server.use(http.get(`${BACKEND_URL}/proxy/metadata/album`, () => HttpResponse.json({ artworkUrl })));
}
