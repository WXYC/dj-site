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
