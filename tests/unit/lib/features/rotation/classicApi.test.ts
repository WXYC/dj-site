import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { rotationApi } from "@/lib/features/rotation/api";
import { rtkQueryErrorLogger } from "@/lib/rtk-query-error-logger";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { describeApi } from "@/tests/helpers/api-harness";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const patchCatalogSearchRotation = vi.hoisted(() => vi.fn());
// The rotation-only store below carries no catalog slice for the real
// implementation to read, and the handler's own catch would swallow the
// selector's complaint as a cache-patch failure.
const cachedAlbumRotationId = vi.hoisted(() => vi.fn<() => number | undefined>(() => undefined));
vi.mock("@/lib/features/catalog/patchSearchCaches", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/features/catalog/patchSearchCaches")>()),
  patchCatalogSearchRotation,
  cachedAlbumRotationId,
}));

function rotationStore() {
  return configureStore({
    reducer: { [rotationApi.reducerPath]: rotationApi.reducer },
    middleware: (gdm) => gdm().concat(rotationApi.middleware),
  });
}

function rotationStoreWithErrorLogger() {
  return configureStore({
    reducer: { [rotationApi.reducerPath]: rotationApi.reducer },
    middleware: (gdm) => gdm().concat(rtkQueryErrorLogger).concat(rotationApi.middleware),
  });
}

const BASE = `${TEST_BACKEND_URL}/library/rotation`;

describe("rotationApi — classic list + free-text add additions", () => {
  describeApi(rotationApi, {
    queries: ["getRotationList", "getUncataloguedRotation"],
    mutations: ["addFreeTextRotationEntry", "updateRotationRow"],
    reducerPath: "rotationApi",
  });

  describe("getRotationList", () => {
    it("asks GET /library/rotation for the full row shape, unconverted", async () => {
      let requested: URL | undefined;
      server.use(
        http.get(BASE, ({ request }) => {
          requested = new URL(request.url);
          return HttpResponse.json([{ id: null, rotation_id: 5001, rotation_bin: "H" }]);
        }),
      );

      const store = rotationStore();
      const result = await store.dispatch(rotationApi.endpoints.getRotationList.initiate());

      expect(requested?.pathname).toBe("/library/rotation");
      expect(result.data).toEqual([{ id: null, rotation_id: 5001, rotation_bin: "H" }]);
    });
  });

  describe("getUncataloguedRotation", () => {
    it("asks GET /library/rotation/uncatalogued with limit/offset params", async () => {
      let requested: URL | undefined;
      server.use(
        http.get(`${BASE}/uncatalogued`, ({ request }) => {
          requested = new URL(request.url);
          return HttpResponse.json([]);
        }),
      );

      const store = rotationStore();
      await store.dispatch(
        rotationApi.endpoints.getUncataloguedRotation.initiate({ limit: 500, offset: 500 }),
      );

      expect(requested?.pathname).toBe("/library/rotation/uncatalogued");
      expect(requested?.searchParams.get("limit")).toBe("500");
      expect(requested?.searchParams.get("offset")).toBe("500");
    });

    it("omits params entirely when called with no args", async () => {
      let requested: URL | undefined;
      server.use(
        http.get(`${BASE}/uncatalogued`, ({ request }) => {
          requested = new URL(request.url);
          return HttpResponse.json([]);
        }),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getUncataloguedRotation.initiate());

      expect(requested?.searchParams.has("limit")).toBe(false);
      expect(requested?.searchParams.has("offset")).toBe(false);
    });

    // The Awaiting Cataloging queue must never read as "there are no
    // uncatalogued releases" on an outage -- this endpoint opts out of the
    // shared backend query's non-JSON soft-handle for that reason, matching
    // labelsApi.searchLabels.
    it("surfaces a non-JSON response as an error rather than an empty list", async () => {
      server.use(
        http.get(
          `${BASE}/uncatalogued`,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      const store = rotationStore();
      const result = await store.dispatch(rotationApi.endpoints.getUncataloguedRotation.initiate());

      expect(result.isError).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe("addFreeTextRotationEntry", () => {
    it("POSTs the free-text body to /library/rotation", async () => {
      let requestBody: unknown;
      server.use(
        http.post(BASE, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json(
            { id: 9001, album_id: null, rotation_bin: "H", add_date: "2026-08-29", kill_date: null },
            { status: 201 },
          );
        }),
      );

      const store = rotationStore();
      const result = await store.dispatch(
        rotationApi.endpoints.addFreeTextRotationEntry.initiate({
          rotation_bin: "H" as never,
          artist_name: "Csillagrablók",
          album_title: "Test Album",
        }),
      );

      expect(requestBody).toEqual({
        rotation_bin: "H",
        artist_name: "Csillagrablók",
        album_title: "Test Album",
      });
      expect(result.data).toMatchObject({ id: 9001 });
    });

    // The caller renders every refusal from this mutation inline (matching
    // the JSP's own validationMessage div), so the shared rejected-query
    // middleware toasting the identical string a second time would report
    // one refusal twice. Nested the same way labelsApi.searchLabels nests
    // its error, under a key the middleware's `payload.data.message` lookup
    // does not recognize.
    it("keeps its rejection message out of the global toast", async () => {
      const { toast } = await import("sonner");
      vi.mocked(toast.error).mockClear();
      server.use(
        http.post(BASE, () =>
          HttpResponse.json({ message: "Missing Parameters: rotation_bin" }, { status: 400 }),
        ),
      );

      const store = rotationStoreWithErrorLogger();
      const result = await store.dispatch(
        rotationApi.endpoints.addFreeTextRotationEntry.initiate({
          rotation_bin: "H" as never,
          artist_name: "Csillagrablók",
          album_title: "Test Album",
        }),
      );

      expect("error" in result).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("invalidates a cached Rotation-tagged query on success", async () => {
      server.use(
        http.get(BASE, () => HttpResponse.json([])),
        http.post(BASE, () =>
          HttpResponse.json(
            { id: 9001, album_id: null, rotation_bin: "H", add_date: "2026-08-29", kill_date: null },
            { status: 201 },
          ),
        ),
      );

      const store = rotationStore();
      // `selectInvalidatedBy` reports cache entries whose *currently
      // provided* tags intersect the given ones -- it has nothing to report
      // until something is actually cached, so the read side is populated
      // first.
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate());
      await store.dispatch(
        rotationApi.endpoints.addFreeTextRotationEntry.initiate({
          rotation_bin: "H" as never,
          artist_name: "Csillagrablók",
          album_title: "Test Album",
        }),
      );

      expect(
        rotationApi.util.selectInvalidatedBy(store.getState(), [{ type: "Rotation" }]),
      ).toEqual([expect.objectContaining({ endpointName: "getRotationList" })]);
    });
  });

  describe("updateRotationRow", () => {
    it("sends every field but rotation_id in the body, and rotation_id in the path", async () => {
      let requestBody: unknown;
      let requestUrl: URL | undefined;
      server.use(
        http.patch(`${BASE}/:id`, async ({ request, params }) => {
          requestUrl = new URL(request.url);
          requestBody = await request.json();
          return HttpResponse.json({
            id: Number(params.id),
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-09-10",
            kill_date: null,
          });
        }),
      );

      const store = rotationStore();
      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({
          rotation_id: 5001,
          artist_name: "Juana Molina",
          album_title: "DOGA",
          record_label: "Sonamos",
          add_date: "2026-09-10",
          format_id: 3,
          label_id: null,
        }),
      );

      expect(requestUrl?.pathname).toBe("/library/rotation/5001");
      expect(requestBody).toEqual({
        artist_name: "Juana Molina",
        album_title: "DOGA",
        record_label: "Sonamos",
        add_date: "2026-09-10",
        format_id: 3,
        label_id: null,
      });
    });

    // A partial PATCH must stay partial: the server SETs only the keys it
    // receives, so passing a key through as `undefined` would serialize it out
    // of the JSON body anyway -- this pins that the arg destructuring does not
    // reintroduce one.
    it("omits a field the caller did not set rather than sending it as null", async () => {
      let requestBody: unknown;
      server.use(
        http.patch(`${BASE}/:id`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-09-10",
            kill_date: null,
          });
        }),
      );

      const store = rotationStore();
      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, album_title: "DOGA" }),
      );

      expect(requestBody).toEqual({ album_title: "DOGA" });
    });

    // The catalog override this writes is the one `killRotationEntry` writes
    // in the other direction, and it shadows the server's value until another
    // write replaces it. An edit that lands a kill date has to clear the badge
    // for the same reason an unkill has to restore it.
    it("clears the catalog's rotation badge when the edit lands a kill date", async () => {
      patchCatalogSearchRotation.mockClear();
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: 42,
            rotation_bin: "M",
            add_date: "2026-08-01",
            kill_date: "2026-08-20",
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({
          rotation_id: 5001,
          kill_date: "2026-08-20",
        }),
      );

      expect(patchCatalogSearchRotation).toHaveBeenCalledWith(expect.anything(), expect.anything(), 42, {
        rotation_bin: undefined,
        rotation_id: undefined,
      });
    });

    // "Killed" and "no longer in rotation" are different dates. A kill
    // scheduled for next week leaves the release in rotation today, so the
    // badge has to stay until the date arrives.
    it("keeps the badge for a kill date that has not arrived yet", async () => {
      patchCatalogSearchRotation.mockClear();
      const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: 42,
            rotation_bin: "M",
            add_date: "2026-08-01",
            kill_date: nextWeek,
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: nextWeek }),
      );

      expect(patchCatalogSearchRotation).toHaveBeenCalledWith(expect.anything(), expect.anything(), 42, {
        rotation_bin: "M",
        rotation_id: 5001,
      });
    });

    it("PATCHes /library/rotation/:id with kill_date: null", async () => {
      let requestBody: unknown;
      let requestUrl: URL | undefined;
      server.use(
        http.patch(`${BASE}/:id`, async ({ request, params }) => {
          requestUrl = new URL(request.url);
          requestBody = await request.json();
          return HttpResponse.json({
            id: Number(params.id),
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-08-01",
            kill_date: null,
          });
        }),
      );

      const store = rotationStore();
      const result = await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }),
      );

      expect(requestUrl?.pathname).toBe("/library/rotation/5001");
      expect(requestBody).toEqual({ kill_date: null });
      expect(result.data).toMatchObject({ kill_date: null });
    });

    // `killRotationEntry` writes a per-album "no rotation" override into the
    // catalog slice, and that override shadows the server's value on every
    // later read -- a refetch does not clear it. Unkilling has to write the
    // restored bin back or the catalog goes on reporting the release as out
    // of rotation for the life of the tab.
    it("restores the catalog's rotation badge for a library-linked row", async () => {
      patchCatalogSearchRotation.mockClear();
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: 42,
            rotation_bin: "M",
            add_date: "2026-08-01",
            kill_date: null,
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }));

      expect(patchCatalogSearchRotation).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        42,
        { rotation_bin: "M", rotation_id: 5001 },
      );
    });

    it("patches nothing for a row that never linked to a library album", async () => {
      patchCatalogSearchRotation.mockClear();
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "M",
            add_date: "2026-08-01",
            kill_date: null,
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }));

      expect(patchCatalogSearchRotation).not.toHaveBeenCalled();
    });

    // The clear is a claim about the album, not about this row. The set
    // gesture adds the replacement before retiring what it replaced, so a
    // correction to the retired row must defer to the cache's newer claim --
    // the same guard `killRotationEntry` carries for the same reason.
    it("leaves the badge alone when the cache names a different rotation row for the album", async () => {
      patchCatalogSearchRotation.mockClear();
      cachedAlbumRotationId.mockReturnValueOnce(9999);
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: 42,
            rotation_bin: "M",
            add_date: "2026-08-01",
            kill_date: "2026-08-20",
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({
          rotation_id: 5001,
          kill_date: "2026-08-20",
        }),
      );

      expect(patchCatalogSearchRotation).not.toHaveBeenCalled();
    });

    // The caller renders every refusal from this mutation inline, so the
    // shared rejected-query middleware toasting the identical string a second
    // time would report one refusal twice.
    it("keeps its rejection message out of the global toast", async () => {
      const { toast } = await import("sonner");
      vi.mocked(toast.error).mockClear();
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({ message: "This release is already catalogued" }, { status: 409 }),
        ),
      );

      const store = rotationStoreWithErrorLogger();
      const result = await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }),
      );

      expect("error" in result).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
    });

    // The response is the updated row. Refetching it would rebuild the form
    // under the librarian who just submitted it, from a body he already holds.
    it("writes the response into the row cache instead of refetching it", async () => {
      let rowReads = 0;
      server.use(
        http.get(`${BASE}/5001`, () => {
          rowReads += 1;
          return HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-08-01",
            kill_date: "2026-08-20",
          });
        }),
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-08-01",
            kill_date: null,
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationRow.initiate(5001));
      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }),
      );

      await vi.waitFor(() =>
        expect(
          rotationApi.endpoints.getRotationRow.select(5001)(store.getState()).data,
        ).toMatchObject({ kill_date: null }),
      );
      expect(rowReads).toBe(1);
    });

    it("invalidates a cached Rotation-tagged query on success", async () => {
      server.use(
        http.get(BASE, () => HttpResponse.json([])),
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-08-01",
            kill_date: null,
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate());
      await store.dispatch(rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }));

      expect(
        rotationApi.util.selectInvalidatedBy(store.getState(), [{ type: "Rotation" }]),
      ).toEqual([expect.objectContaining({ endpointName: "getRotationList" })]);
    });
  });
});
