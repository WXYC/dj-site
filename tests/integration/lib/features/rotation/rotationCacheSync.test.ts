import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import {
  createTestAlbumSearchResult,
  createTestStore,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";
import { RotationBin } from "@/lib/features/rotation/types";
import { catalogApi } from "@/lib/features/catalog/api";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const JUANA_MOLINA_ALBUM_ID = 4242;
const JUANA_MOLINA_ROTATION_ID = 900;

/**
 * The rotation mutations are the only writers of an album's rotation state, so
 * they own keeping the catalog's cached view of it current. Without that, a
 * catalog filtered by rotation bin keeps showing the pre-write answer behind
 * the album panel until the next full search.
 */
describe("rotation mutations keep the catalog's rotation view current", () => {
  it("records the bin an add placed the album in", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
        HttpResponse.json(
          {
            id: JUANA_MOLINA_ROTATION_ID,
            album_id: JUANA_MOLINA_ALBUM_ID,
            rotation_bin: "H",
            add_date: "2026-08-05",
            kill_date: null,
          },
          { status: 201 },
        ),
      ),
    );
    const store = createTestStore();

    await store.dispatch(
      rotationApi.endpoints.addRotationEntry.initiate({
        album_id: JUANA_MOLINA_ALBUM_ID,
        rotation_bin: RotationBin.H,
      }),
    );

    expect(store.getState().catalog.rotationByAlbumId[JUANA_MOLINA_ALBUM_ID]).toEqual({
      rotation_bin: RotationBin.H,
      rotation_id: JUANA_MOLINA_ROTATION_ID,
    });
  });

  it("clears the bin for the album a kill retired", async () => {
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
        HttpResponse.json({
          id: JUANA_MOLINA_ROTATION_ID,
          album_id: JUANA_MOLINA_ALBUM_ID,
          rotation_bin: "H",
          add_date: "2026-08-01",
          kill_date: "2026-08-05",
        }),
      ),
    );
    const store = createTestStore();

    await store.dispatch(
      rotationApi.endpoints.killRotationEntry.initiate({
        rotation_id: JUANA_MOLINA_ROTATION_ID,
      }),
    );

    expect(store.getState().catalog.rotationByAlbumId[JUANA_MOLINA_ALBUM_ID]).toEqual({
      rotation_bin: undefined,
      rotation_id: undefined,
    });
  });

  it("touches nothing when the killed entry never linked to a library album", async () => {
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
        HttpResponse.json({
          id: JUANA_MOLINA_ROTATION_ID,
          album_id: null,
          rotation_bin: "H",
          add_date: "2026-08-01",
          kill_date: "2026-08-05",
        }),
      ),
    );
    const store = createTestStore();

    await store.dispatch(
      rotationApi.endpoints.killRotationEntry.initiate({
        rotation_id: JUANA_MOLINA_ROTATION_ID,
      }),
    );

    expect(store.getState().catalog.rotationByAlbumId).toEqual({});
  });
});

/**
 * Both kill paths must agree about the card: `killRotationEntry` patches
 * `card: null`, and the field-level editor's kill (a `kill_date` write through
 * `updateRotationRow`) has to do the same — otherwise its later unkill finds
 * the pre-kill card still cached and re-presents a claim the release may have
 * left, sending a DJ to the wrong physical card until the next full search.
 */
describe("the field-editor kill/unkill round trip and the cached card", () => {
  const cachedRow = (store: ReturnType<typeof createTestStore>) =>
    catalogApi.endpoints.searchLibraryQueryInfinite
      .select({})(store.getState())
      ?.data?.pages.flatMap((page) => page.results)[0];

  it("clears the card on a kill and does not resurrect it on the unkill", async () => {
    const store = createTestStore();
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/query`, () =>
        HttpResponse.json({
          results: [
            createTestAlbumSearchResult({
              id: JUANA_MOLINA_ALBUM_ID,
              rotation_id: JUANA_MOLINA_ROTATION_ID,
              rotation_bin: "H",
              card: { id: 3, bin: "H", number: 2, name: "Late Aug" },
            }),
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        }),
      ),
      http.patch(
        `${TEST_BACKEND_URL}/library/rotation/${JUANA_MOLINA_ROTATION_ID}`,
        async ({ request }) => {
          const body = (await request.json()) as { kill_date?: string | null };
          return HttpResponse.json({
            id: JUANA_MOLINA_ROTATION_ID,
            album_id: JUANA_MOLINA_ALBUM_ID,
            rotation_bin: "H",
            add_date: "2026-08-01",
            kill_date: body.kill_date ?? null,
          });
        },
      ),
    );
    await store.dispatch(
      catalogApi.endpoints.searchLibraryQueryInfinite.initiate({}),
    );

    await store.dispatch(
      rotationApi.endpoints.updateRotationRow.initiate({
        rotation_id: JUANA_MOLINA_ROTATION_ID,
        kill_date: "2026-09-01",
      }),
    );

    // The kill retracts the card along with the bin: a killed row can never
    // keep pointing at a card it left.
    expect(cachedRow(store)).toEqual(
      expect.objectContaining({ rotation_bin: undefined, card: null }),
    );

    await store.dispatch(
      rotationApi.endpoints.updateRotationRow.initiate({
        rotation_id: JUANA_MOLINA_ROTATION_ID,
        kill_date: null,
      }),
    );

    // The unkill restores the bin but not the pre-kill card claim — where the
    // release was refiled is the server's to report, on the next search read.
    expect(cachedRow(store)).toEqual(
      expect.objectContaining({ rotation_bin: "H", card: null }),
    );
  });
});
