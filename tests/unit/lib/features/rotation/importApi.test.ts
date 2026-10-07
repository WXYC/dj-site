import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { rotationApi } from "@/lib/features/rotation/api";
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
