import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  compareEntriesNewestFirst,
  primaryShowId,
} from "@/lib/features/flowsheet/infinite-cache";
import { partitionFlowsheetEntries } from "@/lib/features/flowsheet/partition";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import {
  createTestStore,
  createTestV2TrackEntry,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
} from "@/tests/helpers";

// Mock the auth client so the base query's prepareHeaders doesn't try to fetch
// a JWT (no auth server running). Mirrors addToFlowsheet.wiring.test.ts.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

const PAST_SHOW = TEST_ENTITY_IDS.SHOW.PAST_SHOW;

/** Prior show's tail — two tracks that predate the DJ going live. */
const priorEntries = [
  createTestV2TrackEntry({ id: 5001, show_id: PAST_SHOW, play_order: 1 }),
  createTestV2TrackEntry({ id: 5002, show_id: PAST_SHOW, play_order: 2 }),
];

function selectEntriesCache(store: ReturnType<typeof createTestStore>) {
  return flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
    store.getState()
  ).data;
}

function selectWhoIsLiveCache(store: ReturnType<typeof createTestStore>) {
  return flowsheetApi.endpoints.whoIsLive.select(undefined)(store.getState())
    .data;
}

function selectNowPlayingCache(store: ReturnType<typeof createTestStore>) {
  return flowsheetApi.endpoints.getNowPlaying.select(undefined)(
    store.getState()
  ).data;
}

/** The seeded now-playing entry — a real track, not a show marker. */
const SEEDED_NOW_PLAYING = priorEntries[1];

async function seedStore(
  onAirDJs: { id: string | null; dj_name: string }[] = []
) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json(priorEntries)
    ),
    http.get(`${TEST_BACKEND_URL}/flowsheet/latest`, () =>
      HttpResponse.json(SEEDED_NOW_PLAYING)
    ),
    http.get(`${TEST_BACKEND_URL}/flowsheet/djs-on-air`, () =>
      HttpResponse.json(onAirDJs)
    ),
    http.post(`${TEST_BACKEND_URL}/flowsheet/join`, () =>
      HttpResponse.json({})
    ),
    http.post(`${TEST_BACKEND_URL}/flowsheet/end`, () => HttpResponse.json({}))
  );

  const store = createTestStore();
  // Prime the caches so the optimistic patches have data to work with.
  await store
    .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
    .unwrap();
  await store
    .dispatch(flowsheetApi.endpoints.whoIsLive.initiate(undefined))
    .unwrap();
  await store
    .dispatch(flowsheetApi.endpoints.getNowPlaying.initiate(undefined))
    .unwrap();
  return store;
}

describe("joinShow optimistic patch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves the previous show's entries out of the current-show pane immediately after goLive (#619)", async () => {
    const store = await seedStore();

    // Sanity: before joining, the newest entry is the prior show, so a naive
    // currentShow would partition the prior show's tail as current.
    expect(primaryShowId(selectEntriesCache(store)!)).toBe(PAST_SHOW);

    // Dispatch without awaiting: the optimistic patch runs synchronously in
    // onQueryStarted, so we inspect the cache during the pre-refetch window.
    const promise = store.dispatch(
      flowsheetApi.endpoints.joinShow.initiate({
        dj_id: "test-user-1",
        dj_name: "Test DJ",
      })
    );

    const cache = selectEntriesCache(store)!;
    const currentShow = primaryShowId(cache);
    // currentShow no longer resolves to the previous show.
    expect(currentShow).not.toBe(PAST_SHOW);

    const allEntries = cache.pages
      .flat()
      .slice()
      .sort(compareEntriesNewestFirst) as FlowsheetEntry[];
    const { current, previous } = partitionFlowsheetEntries(
      allEntries,
      currentShow,
      true
    );

    // No prior-show entry leaks into the current-show pane.
    expect(current.some((e) => e.show_id === PAST_SHOW)).toBe(false);
    // The prior tail is preserved under previous shows.
    expect(previous.filter((e) => e.id === 5001 || e.id === 5002)).toHaveLength(
      2
    );
    // The only current-show entry is the optimistic show-start marker.
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ isStart: true, dj_name: "Test DJ" });

    await promise;
  });

  it("seeds the optimistic banner with the real dj_name, never the 'Live' placeholder (#621)", async () => {
    const store = await seedStore();

    const promise = store.dispatch(
      flowsheetApi.endpoints.joinShow.initiate({
        dj_id: "test-user-1",
        dj_name: "Test DJ",
      })
    );

    const live = selectWhoIsLiveCache(store)!;
    expect(live.onAir).toBe("Test DJ");
    expect(live.onAir).not.toContain("Live");
    expect(live.djs.some((d) => d.dj_name === "Live")).toBe(false);

    await promise;
  });

  it("keeps the previous banner when a DJ with no display name joins solo (#621)", async () => {
    const store = await seedStore();

    const promise = store.dispatch(
      flowsheetApi.endpoints.joinShow.initiate({ dj_id: "test-user-1" })
    );

    const live = selectWhoIsLiveCache(store)!;
    // The DJ still flips live (the id lands in djs)...
    expect(live.djs.some((d) => d.id === "test-user-1")).toBe(true);
    // ...but the banner never blanks and never reads "Live"; it stays the
    // previous value ("Off Air") until the refetch supplies a real name.
    expect(live.onAir).toBe("Off Air");
    expect(live.onAir).not.toBe("");
    expect(live.onAir).not.toContain("Live");

    await promise;
  });

  it("formats the banner without a trailing comma when a no-name DJ joins alongside another DJ (#621)", async () => {
    const store = await seedStore([{ id: "1", dj_name: "Marz" }]);

    const promise = store.dispatch(
      flowsheetApi.endpoints.joinShow.initiate({ dj_id: "test-user-1" })
    );

    const live = selectWhoIsLiveCache(store)!;
    expect(live.djs).toHaveLength(2);
    // Only named DJs render; no "Marz, " trailing comma, no "Live".
    expect(live.onAir).toBe("Marz");

    await promise;
  });

  it("leaveShow removes the optimistic show-start marker when leaving before join's refetch (#619)", async () => {
    const store = await seedStore();

    const joinPromise = store.dispatch(
      flowsheetApi.endpoints.joinShow.initiate({
        dj_id: "test-user-1",
        dj_name: "Test DJ",
      })
    );

    // Marker present during the pre-refetch window.
    expect(
      selectEntriesCache(store)!
        .pages.flat()
        .some((e) => e.show_id < 0)
    ).toBe(true);

    const leavePromise = store.dispatch(
      flowsheetApi.endpoints.leaveShow.initiate({ dj_id: "test-user-1" })
    );

    // leaveShow's optimistic patch drops the orphaned marker immediately...
    const cache = selectEntriesCache(store)!;
    expect(cache.pages.flat().some((e) => e.show_id < 0)).toBe(false);
    // ...while the real prior-show entries survive.
    expect(cache.pages.flat().map((e) => e.id)).toEqual(
      expect.arrayContaining([5001, 5002])
    );

    await Promise.all([joinPromise, leavePromise]);
  });

  it("reaches the Now Playing card with the show-start marker and DJ name before the refetch", async () => {
    const store = await seedStore();

    // Sanity: the seeded card is the prior track, not a show marker.
    expect(selectNowPlayingCache(store)).toMatchObject({ id: 5002 });

    const promise = store.dispatch(
      flowsheetApi.endpoints.joinShow.initiate({
        dj_id: "test-user-1",
        dj_name: "Test DJ",
      })
    );

    // The card flips to the show-start state synchronously, carrying the name.
    expect(selectNowPlayingCache(store)).toMatchObject({
      isStart: true,
      dj_name: "Test DJ",
    });

    await promise;
  });

  it("restores the previous Now Playing card when the join fails", async () => {
    const store = await seedStore();
    server.use(
      http.post(
        `${TEST_BACKEND_URL}/flowsheet/join`,
        () => new HttpResponse(null, { status: 500 })
      )
    );

    const before = selectNowPlayingCache(store);

    await store
      .dispatch(
        flowsheetApi.endpoints.joinShow.initiate({
          dj_id: "test-user-1",
          dj_name: "Test DJ",
        })
      )
      .unwrap()
      .catch(() => {});

    // The optimistic marker is rolled back to the seeded track, never left as
    // a stray marker or blanked.
    expect(selectNowPlayingCache(store)).toEqual(before);
  });

  it("flips the Now Playing card to the show-end state carrying the departing DJ's name", async () => {
    const store = await seedStore([{ id: "test-user-1", dj_name: "Test DJ" }]);

    const promise = store.dispatch(
      flowsheetApi.endpoints.leaveShow.initiate({ dj_id: "test-user-1" })
    );

    expect(selectNowPlayingCache(store)).toMatchObject({
      isStart: false,
      dj_name: "Test DJ",
    });

    await promise;
  });
});
