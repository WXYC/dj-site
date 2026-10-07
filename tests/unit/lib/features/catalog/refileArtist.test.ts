import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { binApi } from "@/lib/features/bin/api";
import { rotationApi } from "@/lib/features/rotation/api";
import { interpretArtistRefileError } from "@/lib/features/catalog/artistRefileOutcome";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const ARTIST_ID = 19516;
const GENRE_ID = 6;
const ARG = { artistId: ARTIST_ID, code_letters: "IS", body: { genre_id: GENRE_ID, code_artist_number: 31 } };
const REFILE_URL = `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/refile`;

const RESULT = {
  artist_id: ARTIST_ID,
  artist_name: "Isis",
  alphabetical_name: "Isis",
  genre_id: GENRE_ID,
  code_letters: "IS",
  code_artist_number: 31,
  release_count: 2,
  cross_reference_source_count: 0,
  cross_reference_target_count: 0,
  library_cross_reference_count: 0,
  compilation_credit_count: 0,
  changed: true,
  previous_code_artist_number: 1,
  releases_to_relabel: 2,
};

type Calls = Record<"card" | "peek" | "byCodeScoped" | "byCodeOther" | "bin" | "rotation", number>;

/** Counts reads for every cache the refile should (or should not) touch. */
async function subscribed() {
  const calls: Calls = { card: 0, peek: 0, byCodeScoped: 0, byCodeOther: 0, bin: 0, rotation: 0 };
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => {
      calls.card += 1;
      return HttpResponse.json(RESULT);
    }),
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () => {
      calls.peek += 1;
      return HttpResponse.json({ next_code_number: 2 });
    }),
    http.get(`${TEST_BACKEND_URL}/library/artists/by-code`, ({ request }) => {
      const letters = new URL(request.url).searchParams.get("code_letters");
      if (letters === "IS") calls.byCodeScoped += 1;
      else calls.byCodeOther += 1;
      return HttpResponse.json({ artists: [] });
    }),
    http.get(`${TEST_BACKEND_URL}/djs/bin`, () => {
      calls.bin += 1;
      return HttpResponse.json([]);
    }),
    http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
      calls.rotation += 1;
      return HttpResponse.json([]);
    }),
  );
  const store = createTestStore();
  const subs = [
    store.dispatch(catalogApi.endpoints.getArtistCard.initiate({ artistId: ARTIST_ID })),
    store.dispatch(catalogApi.endpoints.peekArtistCode.initiate({ code_letters: "IS", genre_id: GENRE_ID })),
    store.dispatch(
      catalogApi.endpoints.resolveArtistByCode.initiate({ code_letters: "IS", genre_id: GENRE_ID, code_number: 31 }),
    ),
    store.dispatch(
      catalogApi.endpoints.resolveArtistByCode.initiate({ code_letters: "AU", genre_id: 15, code_number: 3 }),
    ),
    store.dispatch(binApi.endpoints.getBin.initiate({ dj_id: "dj-1" })),
    store.dispatch(rotationApi.endpoints.getRotation.initiate()),
  ];
  await Promise.all(subs);
  expect(calls).toEqual({ card: 1, peek: 1, byCodeScoped: 1, byCodeOther: 1, bin: 1, rotation: 1 });
  return { store, calls, unsubscribe: () => subs.forEach((s) => s.unsubscribe()) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

describe("refileArtist", () => {
  it("POSTs the body to the refile path and fulfils with the result", async () => {
    let body: unknown;
    server.use(
      http.post(REFILE_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(RESULT);
      }),
    );
    const result = await createTestStore().dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    expect(body).toEqual({ genre_id: GENRE_ID, code_artist_number: 31 });
    expect("data" in result && result.data?.releases_to_relabel).toBe(2);
  });

  it("on success refetches the card, the scoped code caches and the bin and rotation slices, but not other buckets", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, () => HttpResponse.json(RESULT)));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await vi.waitFor(() => expect(calls).toMatchObject({ card: 2, peek: 2, byCodeScoped: 2, bin: 2, rotation: 2 }));
    expect(calls.byCodeOther).toBe(1);
    unsubscribe();
  });

  it("invalidates everything on a 500, where the write may have committed", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 })));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await vi.waitFor(() => expect(calls).toMatchObject({ card: 2, peek: 2, byCodeScoped: 2, bin: 2, rotation: 2 }));
    unsubscribe();
  });

  it("invalidates everything on a transport failure", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, () => HttpResponse.error()));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await vi.waitFor(() => expect(calls).toMatchObject({ card: 2, peek: 2, byCodeScoped: 2, bin: 2, rotation: 2 }));
    unsubscribe();
  });

  it("invalidates nothing on a 409, and hands the interpreter the holder", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    const holder = { id: 7, artist_name: "Autechre", code_artist_number: 31 };
    server.use(
      http.post(REFILE_URL, () =>
        HttpResponse.json({ message: "held", reason: "artist_code_conflict", artist: holder }, { status: 409 }),
      ),
    );

    const result = await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await settle();

    expect(calls).toEqual({ card: 1, peek: 1, byCodeScoped: 1, byCodeOther: 1, bin: 1, rotation: 1 });
    const error = "error" in result ? result.error : undefined;
    expect(error).toHaveProperty("refileArtistError");
    expect(error).not.toHaveProperty("data");
    expect(interpretArtistRefileError(error)).toMatchObject({ reason: "conflict", holder });
    unsubscribe();
  });
});
