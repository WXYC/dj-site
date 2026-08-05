import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";
import { RotationBin } from "@/lib/features/rotation/types";

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
