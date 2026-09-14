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

function rotationStore() {
  return configureStore({
    reducer: { [rotationApi.reducerPath]: rotationApi.reducer },
    middleware: (gdm) => gdm().concat(rotationApi.middleware),
  });
}

const BASE = `${TEST_BACKEND_URL}/library/rotation/cards`;

const HEAVY_2 = { id: 3, bin: "H", number: 2, name: "Heavy 2" };

describe("rotationApi — rotation card CRUD", () => {
  describeApi(rotationApi, {
    queries: ["getRotationCards"],
    mutations: ["addRotationCard", "updateRotationCard", "deleteRotationCard"],
    reducerPath: "rotationApi",
  });

  it("GETs /library/rotation/cards", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(BASE, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json([HEAVY_2]);
      }),
    );

    const store = rotationStore();
    const result = await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());

    expect(requested?.pathname).toBe("/library/rotation/cards");
    expect(result.data).toEqual([HEAVY_2]);
  });

  it("POSTs a new card and invalidates the cached list", async () => {
    let requestBody: unknown;
    server.use(
      http.get(BASE, () => HttpResponse.json([])),
      http.post(BASE, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(HEAVY_2, { status: 201 });
      }),
    );

    const store = rotationStore();
    await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
    const result = await store.dispatch(
      rotationApi.endpoints.addRotationCard.initiate({ bin: "H", name: "Heavy 2" }),
    );

    expect(requestBody).toEqual({ bin: "H", name: "Heavy 2" });
    expect(result.data).toEqual(HEAVY_2);
    expect(
      rotationApi.util.selectInvalidatedBy(store.getState(), [{ type: "RotationCards" }]),
    ).toEqual([expect.objectContaining({ endpointName: "getRotationCards" })]);
  });

  it("PATCHes /library/rotation/cards/:id with the id out of the body", async () => {
    let requestBody: unknown;
    let requested: URL | undefined;
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        requested = new URL(request.url);
        requestBody = await request.json();
        return HttpResponse.json({ ...HEAVY_2, name: "Heavy Two" });
      }),
    );

    const store = rotationStore();
    const result = await store.dispatch(
      rotationApi.endpoints.updateRotationCard.initiate({ id: 3, name: "Heavy Two" }),
    );

    expect(requested?.pathname).toBe("/library/rotation/cards/3");
    expect(requestBody).toEqual({ name: "Heavy Two" });
    expect(result.data).toMatchObject({ name: "Heavy Two" });
  });

  describe("updateRotationRow card assignment", () => {
    const ROTATION_BASE = `${TEST_BACKEND_URL}/library/rotation`;

    // A card move changes the per-card row counts the cards surface reports,
    // so it must reach across the RotationCards/Rotation tag split; any other
    // field edit must not, or the split's whole point (a rename never
    // refetches every rotation list, and vice versa) is lost.
    function installCountingHandlers() {
      const counts = { cards: 0, list: 0 };
      let requested: URL | undefined;
      let requestBody: unknown;
      server.use(
        http.get(BASE, () => {
          counts.cards += 1;
          return HttpResponse.json([HEAVY_2]);
        }),
        http.get(ROTATION_BASE, () => {
          counts.list += 1;
          return HttpResponse.json([]);
        }),
        http.patch(`${ROTATION_BASE}/:id`, async ({ request }) => {
          requested = new URL(request.url);
          requestBody = await request.json();
          return HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-09-01",
            kill_date: null,
          });
        }),
      );
      return { counts, requested: () => requested, requestBody: () => requestBody };
    }

    it("PATCHes {card_id} alone to /library/rotation/:id and refetches the cards read", async () => {
      const handlers = installCountingHandlers();
      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, card_id: 3 }),
      );

      expect(handlers.requested()?.pathname).toBe("/library/rotation/5001");
      expect(handlers.requestBody()).toEqual({ card_id: 3 });
      await vi.waitFor(() => {
        expect(handlers.counts.cards).toBe(2);
        expect(handlers.counts.list).toBe(2);
      });
    });

    it("a non-card edit refetches the rotation list but leaves the cards read alone", async () => {
      const handlers = installCountingHandlers();
      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }),
      );

      await vi.waitFor(() => expect(handlers.counts.list).toBe(2));
      expect(handlers.counts.cards).toBe(1);
    });
  });

  it("DELETEs /library/rotation/cards/:id", async () => {
    let requested: URL | undefined;
    let method: string | undefined;
    server.use(
      http.delete(`${BASE}/:id`, ({ request }) => {
        requested = new URL(request.url);
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const store = rotationStore();
    await store.dispatch(rotationApi.endpoints.deleteRotationCard.initiate(3));

    expect(requested?.pathname).toBe("/library/rotation/cards/3");
    expect(method).toBe("DELETE");
  });
});
