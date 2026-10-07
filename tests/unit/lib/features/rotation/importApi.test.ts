import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { rotationApi } from "@/lib/features/rotation/api";
import { catalogApi } from "@/lib/features/catalog/api";
import { createTestStore } from "@/tests/helpers/store";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { describeApi } from "@/tests/helpers/api-harness";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function rotationStore() {
  return configureStore({
    reducer: { [rotationApi.reducerPath]: rotationApi.reducer },
    middleware: (gdm) => gdm().concat(rotationApi.middleware),
  });
}

const BASE = `${TEST_BACKEND_URL}/library/rotation`;

const ROTATION_ROW = {
  id: 5001,
  album_id: null,
  rotation_bin: "H",
  add_date: "2026-08-01",
  kill_date: "2026-09-01",
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  format_id: 3,
  label_id: null,
};

describe("rotationApi — the import screen's single-row read", () => {
  describeApi(rotationApi, {
    queries: ["getRotationRow"],
    reducerPath: "rotationApi",
  });

  describe("getRotationRow", () => {
    it("asks GET /library/rotation/:id for the row's own pre-catalog fields", async () => {
      let requested: URL | undefined;
      server.use(
        http.get(`${BASE}/:id`, ({ request }) => {
          requested = new URL(request.url);
          return HttpResponse.json(ROTATION_ROW);
        }),
      );

      const store = rotationStore();
      const result = await store.dispatch(rotationApi.endpoints.getRotationRow.initiate(5001));

      expect(requested?.pathname).toBe("/library/rotation/5001");
      expect(result.data).toEqual(ROTATION_ROW);
    });

    // The pre-submit staleness check asks this endpoint whether the row has
    // been linked since the form opened. An unparseable body soft-handled
    // into a successful `null` would answer "no row, therefore not linked",
    // which is the one answer that licenses creating a second library
    // release for a release someone already catalogued.
    it("surfaces a non-JSON response as an error rather than an absent row", async () => {
      server.use(
        http.get(
          `${BASE}/:id`,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      const store = rotationStore();
      const result = await store.dispatch(rotationApi.endpoints.getRotationRow.initiate(5001));

      expect(result.isError).toBe(true);
      expect(result.data).toBeUndefined();
    });

    // The staleness check runs immediately before the create, so it has to be
    // able to ask again rather than replay whatever the screen read on mount.
    it("re-reads the row on demand rather than serving the value it cached on mount", async () => {
      let reads = 0;
      server.use(
        http.get(`${BASE}/:id`, () => {
          reads += 1;
          return HttpResponse.json({ ...ROTATION_ROW, album_id: reads === 1 ? null : 42 });
        }),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationRow.initiate(5001));
      const recheck = await store.dispatch(
        rotationApi.endpoints.getRotationRow.initiate(5001, { forceRefetch: true }),
      );

      expect(reads).toBe(2);
      expect(recheck.data?.album_id).toBe(42);
    });
  });
});

describe("catalogApi.addAlbum — the import's create-and-link request", () => {
  const ALBUM_BODY = {
    album_title: "Edits",
    label: "self-released",
    genre_id: 5,
    format_id: 3,
    artist_id: 771,
  };

  const REFUSAL = {
    message: "Every new release needs a review: file it through the review queue",
    reason: "review_required",
  };

  // The import screen states a refused import in its own approved words, so
  // only a request carrying `from_rotation_id` has the server's message
  // stripped. An ordinary add-release form has no other explanation for the
  // same 409, so the global toast must still carry it.
  it("keeps the server's message, and toasts it, for a refused create without from_rotation_id", async () => {
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/`, () => HttpResponse.json(REFUSAL, { status: 409 })),
    );

    const store = createTestStore();
    const result = await store.dispatch(catalogApi.endpoints.addAlbum.initiate(ALBUM_BODY));

    expect("error" in result && (result.error as { data?: { message?: unknown } }).data?.message).toBe(
      REFUSAL.message,
    );
    expect(toast.error).toHaveBeenCalledWith(REFUSAL.message);
  });

  it("strips the server's message, and toasts nothing, for a refused import carrying from_rotation_id", async () => {
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/`, () => HttpResponse.json(REFUSAL, { status: 409 })),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.addAlbum.initiate({ ...ALBUM_BODY, from_rotation_id: 5001 }),
    );

    expect("error" in result).toBe(true);
    const data = (result as { error: { data?: Record<string, unknown> } }).error.data;
    expect(data?.reason).toBe("review_required");
    expect(data).not.toHaveProperty("message");
    expect(toast.error).not.toHaveBeenCalled();
  });

  // Observed as a refetch, not via `selectInvalidatedBy`: that selector lists
  // the cached queries whose tags match whether or not anything was ever
  // invalidated, so it passes with the cross-slice dispatch removed.
  it("invalidates a cached Rotation-tagged query on a successful import, so the queue drops the row", async () => {
    let queueReads = 0;
    server.use(
      http.get(`${BASE}/uncatalogued`, () => {
        queueReads += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/library/`, () => HttpResponse.json({ id: 8801 }, { status: 201 })),
    );

    const store = createTestStore();
    const queue = store.dispatch(rotationApi.endpoints.getUncataloguedRotation.initiate());
    await queue;
    expect(queueReads).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.addAlbum.initiate({ ...ALBUM_BODY, from_rotation_id: 5001 }),
    );

    await vi.waitFor(() => expect(queueReads).toBe(2));
    queue.unsubscribe();
  });

  it("leaves Rotation-tagged queries alone after a plain create without from_rotation_id", async () => {
    let queueReads = 0;
    server.use(
      http.get(`${BASE}/uncatalogued`, () => {
        queueReads += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/library/`, () => HttpResponse.json({ id: 8801 }, { status: 201 })),
    );

    const store = createTestStore();
    const queue = store.dispatch(rotationApi.endpoints.getUncataloguedRotation.initiate());
    await queue;

    await store.dispatch(catalogApi.endpoints.addAlbum.initiate(ALBUM_BODY));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(queueReads).toBe(1);
    queue.unsubscribe();
  });
});
