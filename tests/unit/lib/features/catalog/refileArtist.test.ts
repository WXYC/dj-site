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
  changed: true,
  previous_code_artist_number: 1,
  releases_to_relabel: 2,
};

const COUNT_KEYS = [
  "card", "peek", "byCodeScoped", "byCodeOther", "bin", "rotation",
  "catalog", "info", "artistReleases", "typeahead", "artistXref", "releaseXref",
] as const;
type Calls = Record<(typeof COUNT_KEYS)[number], number>;
const ZERO = Object.fromEntries(COUNT_KEYS.map((k) => [k, 1])) as Calls;
const bump = (calls: Calls, key: keyof Calls) => (calls[key] += 1);

/** Counts reads for every cache the refile should (or should not) touch. */
async function subscribed() {
  const calls = Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])) as Calls;
  const L = `${TEST_BACKEND_URL}/library`;
  const json = (key: keyof Calls, body: unknown) => () => {
    bump(calls, key);
    return HttpResponse.json(body as never);
  };
  server.use(
    http.get(`${L}/artists/${ARTIST_ID}`, json("card", RESULT)),
    http.get(`${L}/artists/peek-code`, json("peek", { next_code_number: 2 })),
    http.get(`${L}/artists/by-code`, ({ request }) => {
      bump(calls, new URL(request.url).searchParams.get("code_letters") === "IS" ? "byCodeScoped" : "byCodeOther");
      return HttpResponse.json({ artists: [] });
    }),
    http.get(`${TEST_BACKEND_URL}/djs/bin`, json("bin", [])),
    http.get(`${L}/rotation`, json("rotation", [])),
    http.get(`${L}/`, json("catalog", [])),
    http.get(`${L}/info`, json("info", {})),
    http.get(`${L}/artists/${ARTIST_ID}/releases`, json("artistReleases", { artist_id: ARTIST_ID, releases: [], total: 0, page: 1, totalPages: 1 })),
    http.get(`${L}/artists/search`, json("typeahead", { artists: [] })),
    http.get(`${L}/crossreferences/artists`, json("artistXref", { results: [], total: 0, page: 1, totalPages: 1 })),
    http.get(`${L}/crossreferences/releases`, json("releaseXref", { results: [], total: 0, page: 1, totalPages: 1 })),
  );
  const store = createTestStore();
  const e = catalogApi.endpoints;
  const subs = [
    store.dispatch(e.getArtistCard.initiate({ artistId: ARTIST_ID })),
    store.dispatch(e.peekArtistCode.initiate({ code_letters: "IS", genre_id: GENRE_ID })),
    store.dispatch(e.resolveArtistByCode.initiate({ code_letters: "IS", genre_id: GENRE_ID, code_number: 31 })),
    store.dispatch(e.resolveArtistByCode.initiate({ code_letters: "AU", genre_id: 15, code_number: 3 })),
    store.dispatch(binApi.endpoints.getBin.initiate({ dj_id: "dj-1" })),
    store.dispatch(rotationApi.endpoints.getRotation.initiate()),
    store.dispatch(e.searchCatalog.initiate({ artist_name: "Isis", album_title: undefined, n: undefined })),
    store.dispatch(e.getInformation.initiate({ album_id: 1 })),
    store.dispatch(e.getArtistReleases.initiate({ artistId: ARTIST_ID })),
    store.dispatch(e.searchArtistsInGenre.initiate({ genre_id: GENRE_ID, q: "Isis", limit: 10 })),
    store.dispatch(e.listArtistCrossReferences.initiate({})),
    store.dispatch(e.listReleaseCrossReferences.initiate({})),
  ];
  await Promise.all(subs);
  expect(calls).toEqual(ZERO);
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

  const everything = Object.fromEntries(COUNT_KEYS.map((k) => [k, 2])) as Calls;

  it.each([
    { label: "success", respond: () => HttpResponse.json(RESULT) },
    { label: "500", respond: () => HttpResponse.json({ message: "boom" }, { status: 500 }) },
    { label: "transport failure", respond: () => HttpResponse.error() },
  ])("refetches every dependent cache on $label, except other code buckets", async ({ respond }) => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, respond));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await vi.waitFor(() => expect(calls).toEqual({ ...everything, byCodeOther: 1 }));
    unsubscribe();
  });

  it("scopes the code tags from the result's stored bucket on success", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, () => HttpResponse.json({ ...RESULT, code_letters: "AU", genre_id: 15 })));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await vi.waitFor(() => expect(calls.byCodeOther).toBe(2));
    await settle();
    expect(calls.byCodeScoped).toBe(1);
    expect(calls.peek).toBe(1);
    unsubscribe();
  });

  it("changed:false wrote nothing: refetches nothing anywhere", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, () => HttpResponse.json({ ...RESULT, changed: false, releases_to_relabel: 0 })));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await settle();
    expect(calls).toEqual(ZERO);
    unsubscribe();
  });

  it("a 409 artist_code_conflict refetches only the scoped peek and by-code, not other slices", async () => {
    const { store, calls, unsubscribe } = await subscribed();
    const holder = { id: 7, artist_name: "Autechre", code_letters: "IS", code_artist_number: 31, genre_id: GENRE_ID };
    server.use(
      http.post(REFILE_URL, () =>
        HttpResponse.json({ message: "held", reason: "artist_code_conflict", artist: holder }, { status: 409 }),
      ),
    );

    const result = await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await vi.waitFor(() => expect(calls.peek).toBe(2));
    await settle();
    expect(calls).toEqual({ ...ZERO, peek: 2, byCodeScoped: 2 });

    const error = "error" in result ? result.error : undefined;
    expect(error).toHaveProperty("refileArtistError");
    expect(error).not.toHaveProperty("data");
    expect(interpretArtistRefileError(error)).toMatchObject({ reason: "conflict", holder });
    unsubscribe();
  });

  it.each([
    { label: "lettered section 409", status: 409, body: { message: "x", reason: "lettered_compilation_section" } },
    { label: "various artists section 409", status: 409, body: { message: "x", reason: "various_artists_section" } },
    { label: "unknown 409", status: 409, body: { message: "x", reason: "from_the_future" } },
    { label: "404", status: 404, body: { message: "Artist not found" } },
    { label: "400", status: 400, body: { message: "bad" } },
  ])("a $label refetches nothing", async ({ status, body }) => {
    const { store, calls, unsubscribe } = await subscribed();
    server.use(http.post(REFILE_URL, () => HttpResponse.json(body, { status })));

    await store.dispatch(catalogApi.endpoints.refileArtist.initiate(ARG));
    await settle();
    expect(calls).toEqual(ZERO);
    unsubscribe();
  });
});
