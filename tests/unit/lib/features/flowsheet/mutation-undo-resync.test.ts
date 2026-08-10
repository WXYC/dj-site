import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  createTestStore,
  createTestV2TrackEntry,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

// Replace the auth client so the base query's prepareHeaders doesn't try to
// fetch a JWT (no auth server running). Imported by path per the helper's
// own instructions — the barrel would pull in the Redux store, which imports
// the very module being replaced.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

// Mock the deferred-refetch helper (unit-tested in deferred-refetch.test.ts)
// so a successful add doesn't arm a real timer that outlives the test.
vi.mock("@/lib/features/flowsheet/deferred-refetch", () => ({
  scheduleDeferredFlowsheetRefetch: vi.fn(),
}));

function selectEntriesCache(store: ReturnType<typeof createTestStore>) {
  return flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
    store.getState()
  ).data;
}

async function seedEntriesStore() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json([createTestV2TrackEntry({ id: 5000, play_order: 1 })])
    )
  );
  const store = createTestStore();
  await store
    .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
    .unwrap();
  return store;
}

// A concurrent SSE insert can resize pages[0] inside a mutation's request
// window, making undo()'s index-addressed Immer inverse patches remove or
// restore the wrong slots — so every failed mutation that optimistically
// spliced the entries cache must follow its undo with a Flowsheet refetch.
describe("failed-mutation undo resync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("addToFlowsheet failure invalidates Flowsheet after the undo", async () => {
    const store = await seedEntriesStore();
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.json({ error: "active show required" }, { status: 400 })
      )
    );
    const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");

    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "Jessica Pratt",
          album_title: "On Your Own Love Again",
          track_title: "Back, Baby",
          record_label: "Drag City",
          request_flag: false,
        })
      )
      .unwrap()
      .catch(() => undefined);

    expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet"]);
  });

  it("joinShow failure invalidates Flowsheet after the undos", async () => {
    const store = await seedEntriesStore();
    server.use(
      http.post(
        `${TEST_BACKEND_URL}/flowsheet/join`,
        () => new HttpResponse(null, { status: 500 })
      )
    );
    const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");

    await store
      .dispatch(
        flowsheetApi.endpoints.joinShow.initiate({
          dj_id: "test-user-1",
          dj_name: "Test DJ",
        })
      )
      .unwrap()
      .catch(() => undefined);

    expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet"]);
  });

  it("leaveShow failure invalidates Flowsheet after the undos", async () => {
    const store = await seedEntriesStore();
    server.use(
      http.post(
        `${TEST_BACKEND_URL}/flowsheet/end`,
        () => new HttpResponse(null, { status: 500 })
      )
    );
    const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");

    await store
      .dispatch(
        flowsheetApi.endpoints.leaveShow.initiate({ dj_id: "test-user-1" })
      )
      .unwrap()
      .catch(() => undefined);

    expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet"]);
  });
});

describe("addToFlowsheet no-optimistic fulfillment lane", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not duplicate a row that landed in the cache while the POST was in flight", async () => {
    // The mutation starts against an uninitialized cache (no optimistic temp
    // row), and the row arrives in the cache before the POST resolves — in
    // production via the SSE insert splice, here via the initial GET. The
    // fulfillment lane must keep the id present exactly once:
    // insertEntrySortedFirstPage alone does not dedupe.
    const serverEntry = createTestV2TrackEntry({ id: 12345, play_order: 2 });
    let releasePost!: () => void;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        await postGate;
        return HttpResponse.json(serverEntry);
      }),
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.json([
          serverEntry,
          createTestV2TrackEntry({ id: 5000, play_order: 1 }),
        ])
      )
    );

    const store = createTestStore();
    const mutation = store.dispatch(
      flowsheetApi.endpoints.addToFlowsheet.initiate({
        artist_name: "Jessica Pratt",
        album_title: "On Your Own Love Again",
        track_title: "Back, Baby",
        record_label: "Drag City",
        request_flag: false,
      })
    );
    await store
      .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
      .unwrap();
    releasePost();
    await mutation.unwrap();

    const ids = (selectEntriesCache(store)?.pages ?? [])
      .flat()
      .map((e) => e.id);
    expect(ids.filter((id) => id === 12345)).toHaveLength(1);
    expect(ids).toContain(5000);
  });
});
