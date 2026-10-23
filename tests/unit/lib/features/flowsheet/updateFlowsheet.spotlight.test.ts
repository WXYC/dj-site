import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { createTestV2SpotlightEntry } from "@/tests/fixtures/fixtures";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

function rowMessage(store: ReturnType<typeof createTestStore>) {
  const data = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
    store.getState()
  ).data;
  return (data?.pages ?? []).flat().find((e) => e.id === 7100) as
    | { message: string; spotlight_name: string }
    | undefined;
}

async function seed() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json([
        createTestV2SpotlightEntry({
          id: 7100,
          spotlight_role: "performer",
          spotlight_name: "Porch Static",
        }),
      ])
    )
  );
  const store = createTestStore();
  await store
    .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
    .unwrap();
  return store;
}

describe("updateFlowsheet on a who's-on row", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-words the row's message from its role and the new name before the server answers", async () => {
    const store = await seed();
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        await delay("infinite");
        return new HttpResponse(null, { status: 200 });
      })
    );

    void store.dispatch(
      flowsheetApi.endpoints.updateFlowsheet.initiate({
        entry_id: 7100,
        data: { spotlight_name: "Porch Static Duo" },
      })
    );

    await vi.waitFor(() => {
      expect(rowMessage(store)?.spotlight_name).toBe("Porch Static Duo");
    });
    expect(rowMessage(store)?.message).toBe("Porch Static Duo live in the studio");
  });

  it("returns the row to its old name and message when the write fails", async () => {
    const store = await seed();
    server.use(
      http.patch(
        `${TEST_BACKEND_URL}/flowsheet/`,
        () => new HttpResponse(null, { status: 500 })
      )
    );

    await store
      .dispatch(
        flowsheetApi.endpoints.updateFlowsheet.initiate({
          entry_id: 7100,
          data: { spotlight_name: "Porch Static Duo" },
        })
      )
      .unwrap()
      .catch(() => undefined);

    await vi.waitFor(() => {
      expect(rowMessage(store)?.spotlight_name).toBe("Porch Static");
    });
    expect(rowMessage(store)?.message).toBe("Porch Static live in the studio");
  });
});
