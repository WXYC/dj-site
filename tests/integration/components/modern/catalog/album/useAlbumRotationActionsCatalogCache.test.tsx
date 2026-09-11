import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";
import {
  createTestStore,
  createTestAlbum,
  createTestArtist,
  createTestAlbumSearchResult,
  fakeRotationEndpoints,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";
import type { Rotation } from "@/lib/features/rotation/types";
import type { AppStore } from "@/lib/store";
import { useAlbumRotationActions } from "@/src/components/experiences/modern/catalog/album/useAlbumRotationActions";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const ALBUM_ID = 4242;
const ROTATION_ID = 900;

const dogaAlbum = () =>
  createTestAlbum({
    id: ALBUM_ID,
    title: "DOGA",
    artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 12 }),
    label: "Sonamos",
  });

/** The `/library/query` row for the album, in whichever bin the list has it. */
const dogaSearchRow = (rotationBin: Rotation) =>
  createTestAlbumSearchResult({
    id: ALBUM_ID,
    album_title: "DOGA",
    artist_name: "Juana Molina",
    code_letters: "MO",
    code_artist_number: 12,
    genre_name: "Rock",
    format_name: "CD",
    rotation_id: ROTATION_ID,
    rotation_bin: rotationBin,
  });

/** The `/library/rotation` row the classify control matches an album on. */
const dogaRotationRow = (rotationBin: string) => ({
  id: ALBUM_ID,
  code_letters: "MO",
  code_artist_number: 12,
  code_number: 3,
  artist_name: "Juana Molina",
  alphabetical_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  genre_name: "Rock",
  format_name: "CD",
  rotation_id: ROTATION_ID,
  add_date: "2026-07-01",
  rotation_add_date: "2026-08-01",
  rotation_bin: rotationBin,
  rotation_kill_date: null,
  plays: 4,
});

function wrapper(store: AppStore): (props: PropsWithChildren) => ReactElement {
  return ({ children }) => <Provider store={store}>{children}</Provider>;
}

/**
 * Seeds a `/library/query` page the way a browse does, so the rotation writes
 * have a real cache entry to patch instead of a hand-built draft.
 */
async function seedCatalogSearch(
  store: AppStore,
  args: { rotation_bins?: string },
  row: ReturnType<typeof dogaSearchRow>,
) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/query`, () =>
      HttpResponse.json({ results: [row], total: 1, page: 0, totalPages: 1 }),
    ),
  );
  await store.dispatch(
    catalogApi.endpoints.searchLibraryQueryInfinite.initiate(args),
  );
}

function cachedRows(store: AppStore, args: { rotation_bins?: string }) {
  return (
    catalogApi.endpoints.searchLibraryQueryInfinite
      .select(args)(store.getState())
      ?.data?.pages.flatMap((page) => page.results) ?? []
  );
}

/**
 * Both rotation mutations patch the catalog cache keyed on album id, and the set
 * gesture deliberately adds the replacement before retiring the prior entries.
 * That order puts the retire's patch last, so it is the one the cache ends up
 * believing -- and a retire says nothing about an album that has just been
 * placed in a new bin.
 */
describe("a re-bin through the shared hook leaves the catalog cache on the new bin", () => {
  it("keeps the new bin on the cached catalog rows", async () => {
    const store = createTestStore();
    await seedCatalogSearch(store, {}, dogaSearchRow("H"));
    const backend = fakeRotationEndpoints([dogaRotationRow("H")], {
      buildRow: dogaRotationRow,
    });

    const { result } = renderHook(() => useAlbumRotationActions(dogaAlbum()), {
      wrapper: wrapper(store),
    });

    await act(async () => {
      await result.current.setRotation("M", [{ rotation_id: ROTATION_ID }]);
    });

    expect(backend.callOrder()).toEqual(["add", "kill"]);
    // The per-album claim is scaffolding for the gesture, not a record of it:
    // it exists so this gesture's own retires cannot clear the bin the gesture
    // just added, and it is dropped once the gesture settles so that a later
    // out-of-band replacement cannot be measured against a stale claim. What
    // outlives the gesture is the cached row below.
    expect(store.getState().catalog.rotationByAlbumId[ALBUM_ID]).toBeUndefined();
    expect(cachedRows(store, {})).toEqual([
      expect.objectContaining({
        id: ALBUM_ID,
        rotation_bin: "M",
        rotation_id: ROTATION_ID + 1,
      }),
    ]);
  });

  it("does not drop the row out of a rotation-filtered cache", async () => {
    const args = { rotation_bins: "H,M" };
    const store = createTestStore();
    await seedCatalogSearch(store, args, dogaSearchRow("H"));
    const backend = fakeRotationEndpoints([dogaRotationRow("H")], {
      buildRow: dogaRotationRow,
    });

    const { result } = renderHook(() => useAlbumRotationActions(dogaAlbum()), {
      wrapper: wrapper(store),
    });

    await act(async () => {
      await result.current.setRotation("M", [{ rotation_id: ROTATION_ID }]);
    });

    expect(backend.killBodies()).toEqual([{ rotation_id: ROTATION_ID }]);
    // A cleared bin no longer matches the filter, so the stale clear removed
    // the row from the list the MD was looking at rather than just mislabelling
    // it.
    expect(cachedRows(store, args)).toEqual([
      expect.objectContaining({ id: ALBUM_ID, rotation_bin: "M" }),
    ]);
  });

  /**
   * The claim the set gesture leaves behind is a statement about the server, and
   * the server can move without this tab hearing about it — a second MD, another
   * tab, the classic rotation screen. A claim that outlived its gesture would be
   * measured against whatever entry the album really has by then, not match, and
   * suppress the very clear it was built to suppress only within the gesture.
   */
  it("clears the cached bin for a kill of an entry the set gesture never saw", async () => {
    const OUT_OF_BAND_ROTATION_ID = 950;
    const store = createTestStore();
    await seedCatalogSearch(store, {}, dogaSearchRow("H"));
    fakeRotationEndpoints(
      [
        dogaRotationRow("H"),
        { ...dogaRotationRow("L"), rotation_id: OUT_OF_BAND_ROTATION_ID },
      ],
      { buildRow: dogaRotationRow },
    );

    const { result } = renderHook(() => useAlbumRotationActions(dogaAlbum()), {
      wrapper: wrapper(store),
    });

    await act(async () => {
      await result.current.setRotation("M", [{ rotation_id: ROTATION_ID }]);
    });

    // Whatever this tab believes the album's entry to be, it is not the one the
    // kill below names.
    await act(async () => {
      await result.current.kill(OUT_OF_BAND_ROTATION_ID);
    });

    expect(cachedRows(store, {})).toEqual([
      expect.objectContaining({ id: ALBUM_ID, rotation_bin: undefined }),
    ]);
  });

  it("still clears the cached bin for a plain kill with no replacement", async () => {
    const store = createTestStore();
    await seedCatalogSearch(store, {}, dogaSearchRow("H"));
    fakeRotationEndpoints([dogaRotationRow("H")], { buildRow: dogaRotationRow });

    const { result } = renderHook(() => useAlbumRotationActions(dogaAlbum()), {
      wrapper: wrapper(store),
    });

    await act(async () => {
      await result.current.kill(ROTATION_ID);
    });

    expect(store.getState().catalog.rotationByAlbumId[ALBUM_ID]).toEqual({
      rotation_bin: undefined,
      rotation_id: undefined,
    });
    expect(cachedRows(store, {})).toEqual([
      expect.objectContaining({ id: ALBUM_ID, rotation_bin: undefined }),
    ]);
  });
});
