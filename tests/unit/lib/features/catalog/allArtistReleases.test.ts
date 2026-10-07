import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { serveArtistReleasePages } from "@/tests/fakes/artistReleases";
import { catalogApi } from "@/lib/features/catalog/api";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// The classic cards list a whole shelf, which Backend serves at most 100 rows
// a page. A lettered Rock compilation section holds ~78
// releases and the plain 'Various Artists' umbrella ~3,100.

const ARTIST_ID = 4211;

const shelf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: 1000 + i, code_number: i + 1 }));

async function readAll(arg: { artistId: number; genre_id?: number }) {
  const store = createTestStore();
  const sub = store.dispatch(catalogApi.endpoints.getAllArtistReleases.initiate(arg));
  const result = await sub;
  sub.unsubscribe();
  return result;
}

describe("getAllArtistReleases", () => {
  it("walks every page at Backend's maximum limit and keeps shelf order", async () => {
    const requests = serveArtistReleasePages(ARTIST_ID, shelf(230));

    const { data } = await readAll({ artistId: ARTIST_ID });

    expect(data?.releases.map((r) => r.id)).toEqual(shelf(230).map((r) => r.id));
    expect(data?.total).toBe(230);
    expect(data?.incomplete).toBe(false);
    expect(requests.map((p) => p.get("limit"))).toEqual(["100", "100", "100"]);
    expect(requests.map((p) => p.get("page")).sort()).toEqual(["0", "1", "2"]);
  });

  it("scopes every page to the card's genre", async () => {
    const requests = serveArtistReleasePages(ARTIST_ID, shelf(150));

    await readAll({ artistId: ARTIST_ID, genre_id: 7 });

    expect(requests.map((p) => p.get("genre_id"))).toEqual(["7", "7"]);
  });

  it("makes one request for an empty shelf, which Backend reports as 0 pages", async () => {
    const requests = serveArtistReleasePages(ARTIST_ID, []);

    const { data } = await readAll({ artistId: ARTIST_ID });

    expect(data).toMatchObject({ releases: [], total: 0, incomplete: false });
    expect(requests).toHaveLength(1);
  });

  // The rows past a failed page are dropped, not spliced in after a gap, so
  // what the card shows is still the head of the shelf in shelf order.
  it("keeps the pages before a failed one and marks the list incomplete", async () => {
    serveArtistReleasePages(ARTIST_ID, shelf(230), { failPages: [1] });

    const { data, isError } = await readAll({ artistId: ARTIST_ID });

    expect(isError).toBe(false);
    expect(data?.releases.map((r) => r.id)).toEqual(shelf(100).map((r) => r.id));
    expect(data?.total).toBe(230);
    expect(data?.incomplete).toBe(true);
  });

  it("is an error when the first page fails, since nothing about the shelf is known", async () => {
    serveArtistReleasePages(ARTIST_ID, shelf(230), { failPages: [0] });

    const { data, isError } = await readAll({ artistId: ARTIST_ID });

    expect(isError).toBe(true);
    expect(data).toBeUndefined();
  });

  // A release moved off this shelf is invalidated through the shared LIST tag,
  // since the mutation's args name only its destination.
  it("re-reads the whole shelf when a write invalidates the artist release tables", async () => {
    const requests = serveArtistReleasePages(ARTIST_ID, shelf(150));
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/53375`, () => HttpResponse.json({ id: 53375 })),
    );
    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.getAllArtistReleases.initiate({ artistId: ARTIST_ID }),
    );
    await sub;
    expect(requests).toHaveLength(2);

    await store.dispatch(
      catalogApi.endpoints.updateAlbum.initiate({
        albumId: 53375,
        body: { artist_id: 8802, genre_id: 5 },
      }),
    );

    await vi.waitFor(() => expect(requests).toHaveLength(4));
    sub.unsubscribe();
  });
});
