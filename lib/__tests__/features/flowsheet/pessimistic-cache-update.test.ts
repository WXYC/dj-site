import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { AppStore } from "@/lib/store";
import type { FlowsheetSongEntry, FlowsheetMessageEntry } from "@/lib/features/flowsheet/types";

const BACKEND_URL = "http://localhost:3001";

// Mock the authentication client to prevent token fetch issues
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// Mock the backend module so the base URL is defined at module-load time
vi.mock("@/lib/features/backend", async () => {
  const { fetchBaseQuery } = await import("@reduxjs/toolkit/query");
  return {
    backendBaseQuery: (domain: string) =>
      fetchBaseQuery({
        baseUrl: `http://localhost:3001/${domain}`,
        prepareHeaders: (headers: Headers) => {
          headers.set("Content-Type", "application/json");
          headers.set("Authorization", "Bearer test-token");
          return headers;
        },
      }),
  };
});

// Import after mocks so the mocked backend is used
const { flowsheetApi } = await import("@/lib/features/flowsheet/api");
const { makeStore } = await import("@/lib/store");
const {
  server,
  TEST_ENTITY_IDS,
  createTestV2TrackEntry,
  createTestV2TalksetEntry,
} = await import("@/lib/test-utils");

describe("addToFlowsheet pessimistic cache update", () => {
  /**
   * Seeds the infinite query cache by fetching initial data via MSW.
   * Returns the store and a cleanup function. The subscription must stay
   * active so that tag invalidation triggers a refetch rather than
   * removing the cache entry.
   */
  async function createStoreWithCachedPage(
    ...v2Entries: ReturnType<typeof createTestV2TrackEntry>[]
  ): Promise<{ store: AppStore; cleanup: () => void }> {
    server.use(
      http.get(`${BACKEND_URL}/flowsheet/`, () => {
        return HttpResponse.json(v2Entries);
      })
    );

    const store = makeStore();
    const subscription = store.dispatch(
      flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined)
    );
    await subscription;
    return { store, cleanup: () => subscription.unsubscribe() };
  }

  function getFirstPage(store: AppStore) {
    const state = store.getState();
    const cacheEntry =
      flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(state);
    return cacheEntry.data?.pages[0];
  }

  it("should insert the new entry at the beginning of the first page after mutation succeeds", async () => {
    const existingV2Entry = createTestV2TrackEntry({
      id: TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1,
      play_order: 1,
    });

    const newServerEntry = createTestV2TrackEntry({
      id: TEST_ENTITY_IDS.FLOWSHEET.ENTRY_2,
      play_order: 2,
      artist_name: "Juana Molina",
      album_title: "DOGA",
      track_title: "la paradoja",
      record_label: "Sonamos",
    });

    const { store, cleanup } = await createStoreWithCachedPage(existingV2Entry);

    server.use(
      http.post(`${BACKEND_URL}/flowsheet/`, () => {
        return HttpResponse.json(newServerEntry);
      })
    );

    await store.dispatch(
      flowsheetApi.endpoints.addToFlowsheet.initiate({
        artist_name: "Juana Molina",
        album_title: "DOGA",
        track_title: "la paradoja",
        request_flag: false,
        record_label: "Sonamos",
      })
    );

    const firstPage = getFirstPage(store);

    expect(firstPage).toBeDefined();
    expect(firstPage).toHaveLength(2);
    // New entry should be first (unshifted)
    expect(firstPage![0].id).toBe(TEST_ENTITY_IDS.FLOWSHEET.ENTRY_2);
    expect((firstPage![0] as FlowsheetSongEntry).artist_name).toBe(
      "Juana Molina"
    );
    expect((firstPage![0] as FlowsheetSongEntry).track_title).toBe(
      "la paradoja"
    );
    // Original entry should still be second
    expect(firstPage![1].id).toBe(TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1);

    cleanup();
  });

  it("should convert the server response using convertV2Entry before inserting", async () => {
    const existingV2Entry = createTestV2TrackEntry();

    const newServerEntry = createTestV2TalksetEntry({
      id: TEST_ENTITY_IDS.FLOWSHEET.ENTRY_2,
      play_order: 2,
      message: "Talkset about upcoming event",
    });

    const { store, cleanup } = await createStoreWithCachedPage(existingV2Entry);

    server.use(
      http.post(`${BACKEND_URL}/flowsheet/`, () => {
        return HttpResponse.json(newServerEntry);
      })
    );

    await store.dispatch(
      flowsheetApi.endpoints.addToFlowsheet.initiate({
        message: "Talkset about upcoming event",
        entry_type: "talkset",
      })
    );

    const firstPage = getFirstPage(store);

    expect(firstPage).toHaveLength(2);
    const insertedEntry = firstPage![0] as FlowsheetMessageEntry;
    expect(insertedEntry.message).toBe("Talkset about upcoming event");
    expect(insertedEntry.id).toBe(TEST_ENTITY_IDS.FLOWSHEET.ENTRY_2);

    cleanup();
  });

  it("should not update the cache when the mutation fails", async () => {
    const existingV2Entry = createTestV2TrackEntry();

    const { store, cleanup } = await createStoreWithCachedPage(existingV2Entry);

    server.use(
      http.post(`${BACKEND_URL}/flowsheet/`, () => {
        return HttpResponse.json(
          { message: "Server error" },
          { status: 500 }
        );
      })
    );

    await store.dispatch(
      flowsheetApi.endpoints.addToFlowsheet.initiate({
        artist_name: "Stereolab",
        album_title: "Aluminum Tunes",
        track_title: "Iron Man",
        request_flag: false,
      })
    );

    const firstPage = getFirstPage(store);

    expect(firstPage).toHaveLength(1);
    expect(firstPage![0].id).toBe(TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1);

    cleanup();
  });

  it("should preserve server-assigned id and play_order from the response", async () => {
    const existingV2Entry = createTestV2TrackEntry({
      id: 100,
      play_order: 50,
    });

    const serverAssignedId = 9999;
    const serverAssignedPlayOrder = 51;

    const newServerEntry = createTestV2TrackEntry({
      id: serverAssignedId,
      play_order: serverAssignedPlayOrder,
      artist_name: "Cat Power",
      album_title: "Moon Pix",
      track_title: "Metal Heart",
      record_label: "Matador Records",
    });

    const { store, cleanup } = await createStoreWithCachedPage(existingV2Entry);

    server.use(
      http.post(`${BACKEND_URL}/flowsheet/`, () => {
        return HttpResponse.json(newServerEntry);
      })
    );

    await store.dispatch(
      flowsheetApi.endpoints.addToFlowsheet.initiate({
        artist_name: "Cat Power",
        album_title: "Moon Pix",
        track_title: "Metal Heart",
        request_flag: false,
        record_label: "Matador Records",
      })
    );

    const firstPage = getFirstPage(store);
    const insertedEntry = firstPage![0];

    expect(insertedEntry.id).toBe(serverAssignedId);
    expect(insertedEntry.play_order).toBe(serverAssignedPlayOrder);

    cleanup();
  });
});
