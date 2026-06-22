import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  createTestStore,
  createTestV2TrackEntry,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
} from "@/lib/test-utils";
import type { AppStore } from "@/lib/store";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

vi.mock("@/lib/features/flowsheet/deferred-refetch", () => ({
  scheduleDeferredFlowsheetRefetch: vi.fn(),
}));

function getCachedEntries(store: AppStore): FlowsheetEntry[] {
  const state = store.getState();
  const cached = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
    state
  );
  return (cached.data?.pages ?? []).flat();
}

const SHOW_ID = TEST_ENTITY_IDS.SHOW.CURRENT_SHOW;

describe("addToFlowsheet — newest-first ordering invariant (#746)", () => {
  beforeEach(() => {
    // Baseline page 0: two existing tracks (ids 100, 99), newest first.
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get("page");
        if (page === "0") {
          return HttpResponse.json([
            createTestV2TrackEntry({
              id: 100,
              show_id: SHOW_ID,
              play_order: 2,
              track_title: "dubbing you",
              artist_name: "sneaker social club",
            }),
            createTestV2TrackEntry({
              id: 99,
              show_id: SHOW_ID,
              play_order: 1,
              track_title: "older track",
              artist_name: "older artist",
            }),
          ]);
        }
        return HttpResponse.json([]);
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("places the newest entry above the previous one after a single add", async () => {
    let nextId = 101;
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        const id = nextId++;
        return HttpResponse.json(
          createTestV2TrackEntry({
            id,
            show_id: SHOW_ID,
            play_order: id - 98,
            track_title: "guéreh",
            artist_name: "GLITTERBEAT",
          })
        );
      })
    );

    const store = createTestStore();
    await store
      .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
      .unwrap();

    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "GLITTERBEAT",
          album_title: "(album)",
          track_title: "guéreh",
          record_label: "GLITTERBEAT",
          request_flag: false,
        })
      )
      .unwrap();

    const ids = getCachedEntries(store).map((e) => e.id);
    expect(ids).toEqual([101, 100, 99]);
  });

  it("places successive adds newest-first when each finishes before the next starts", async () => {
    let nextId = 101;
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        const id = nextId++;
        return HttpResponse.json(
          createTestV2TrackEntry({
            id,
            show_id: SHOW_ID,
            play_order: id - 98,
            track_title: `track-${id}`,
            artist_name: `artist-${id}`,
          })
        );
      })
    );

    const store = createTestStore();
    await store
      .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
      .unwrap();

    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "sneaker social club v2",
          album_title: "(album)",
          track_title: "dubbing you (rerun)",
          record_label: "",
          request_flag: false,
        })
      )
      .unwrap();

    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "GLITTERBEAT",
          album_title: "(album)",
          track_title: "guéreh",
          record_label: "GLITTERBEAT",
          request_flag: false,
        })
      )
      .unwrap();

    const ids = getCachedEntries(store).map((e) => e.id);
    // Newest add (B, id=102) must appear above previous add (A, id=101).
    expect(ids).toEqual([102, 101, 100, 99]);
  });

  it("places overlapping adds newest-first when both temps are in flight simultaneously", async () => {
    let nextId = 101;
    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const firstStarted = new Promise<void>((r) => (resolveFirst = r));
    const secondStarted = new Promise<void>((r) => (resolveSecond = r));

    let postCount = 0;
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        postCount++;
        if (postCount === 1) {
          resolveFirst?.();
          // Wait for second mutation to also start before the first responds,
          // so both optimistic temps coexist in cache.
          await secondStarted;
        } else {
          resolveSecond?.();
        }
        const id = nextId++;
        return HttpResponse.json(
          createTestV2TrackEntry({
            id,
            show_id: SHOW_ID,
            play_order: id - 98,
            track_title: `track-${id}`,
            artist_name: `artist-${id}`,
          })
        );
      })
    );

    const store = createTestStore();
    await store
      .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
      .unwrap();

    const firstPromise = store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "first-artist",
          album_title: "first-album",
          track_title: "first-track",
          record_label: "",
          request_flag: false,
        })
      )
      .unwrap();

    await firstStarted;

    const secondPromise = store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "second-artist",
          album_title: "second-album",
          track_title: "second-track",
          record_label: "",
          request_flag: false,
        })
      )
      .unwrap();

    await Promise.all([firstPromise, secondPromise]);

    const ids = getCachedEntries(store).map((e) => e.id);
    expect(ids).toEqual([102, 101, 100, 99]);
  });

  it("preserves chronological newest-first ordering when the server assigns ids non-monotonically", async () => {
    // Real-world reproducer (WXYC/dj-site#746, observed during dj hydra's show
    // 2026-06-06): a flowsheet refetch interleaves a row whose server id is
    // numerically LARGER than a row the DJ added LATER. Plausible sources of
    // non-monotonic ids: legacy tubafrenzy → BS sync backfilling rows after
    // the mirror restored that morning, or concurrent inserts. The DJ added A
    // then B chronologically; the rendered order must still surface B above A
    // even if A's row id > B's row id, because the user's mental model is
    // chronological, not server-sequence-numeric.
    let postCount = 0;
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        postCount++;
        const id = postCount === 1 ? 102 : 101;
        const addTime =
          postCount === 1
            ? "2026-06-06T20:10:00.000Z"
            : "2026-06-06T20:11:00.000Z";
        return HttpResponse.json(
          createTestV2TrackEntry({
            id,
            show_id: SHOW_ID,
            play_order: postCount,
            add_time: addTime,
            track_title: postCount === 1 ? "dubbing you" : "guéreh",
            artist_name: postCount === 1 ? "first" : "second",
          })
        );
      })
    );

    const store = createTestStore();
    await store
      .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
      .unwrap();

    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "first",
          album_title: "first-album",
          track_title: "dubbing you",
          record_label: "",
          request_flag: false,
        })
      )
      .unwrap();

    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "second",
          album_title: "second-album",
          track_title: "guéreh",
          record_label: "",
          request_flag: false,
        })
      )
      .unwrap();

    const titles = getCachedEntries(store)
      .map((e) => ("track_title" in e ? e.track_title : null))
      .filter((t): t is string => t !== null);
    // Chronological newest-first: "guéreh" was added second, should sit above
    // "dubbing you" regardless of server-assigned ids.
    expect(titles.slice(0, 2)).toEqual(["guéreh", "dubbing you"]);
  });
});
