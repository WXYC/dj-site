import type { PropsWithChildren } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";

import {
  useOpenShowHandoff,
  type GoLiveOutcome,
} from "@/src/hooks/flowsheetHooks";
import { useGoLiveHandoff } from "@/src/hooks/goLiveHandoffHooks";
import { ONE_TAP_TAG_REFUSED_SENTENCE } from "@/lib/features/specialty/copy";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import type { AppStore } from "@/lib/store";
import {
  createTestStore,
  createTestOnAirDJResponse,
  createTestV2TrackEntry,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
} from "@/tests/helpers";

/**
 * Unlike flowsheetHooks.test.tsx (which mocks `@/lib/features/flowsheet/api`
 * wholesale), this file exercises useOpenShowHandoff and useGoLiveHandoff
 * against the REAL flowsheetApi reducer + a real (test) store, with MSW
 * standing in for Backend-Service. That's the whole point of "direct"
 * hook-level tests here: useOpenShowHandoff reads the RTK Query cache via
 * `flowsheetApi.endpoints.*.select(...)`, which a wholesale API mock can't
 * populate. useGoLiveHandoff composes useOpenShowHandoff directly (not
 * through a caller-supplied indirection), so it needs the same cache primed
 * the same way — the two hooks share one harness here rather than living in
 * separate files.
 */

// prepareHeaders() awaits a JWT lookup on every request; without this the base
// query hangs trying to reach a real better-auth client with no server behind
// it. Imported by path from inside the factory, never through the
// `@/tests/helpers` barrel — the barrel pulls in the Redux store, which imports
// the very module being replaced.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

const CURRENT_USER = {
  id: "test-user-1",
  real_name: "Test User",
  dj_name: "Test DJ",
};

const mockUseRegistry = vi.fn(() => ({
  loading: false,
  info: CURRENT_USER as typeof CURRENT_USER | null,
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => mockUseRegistry(),
}));

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

function wrapperFor(store: AppStore) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}

/**
 * Primes the two caches useOpenShowHandoff reads (whoIsLive, getInfiniteEntries)
 * exactly as useShowControl's own subscriptions would have in production —
 * useOpenShowHandoff opens no subscription of its own and only reads what's
 * already there.
 */
async function primeCaches(
  store: AppStore,
  opts: {
    onAir?: ReturnType<typeof createTestOnAirDJResponse>[];
    entries?: ReturnType<typeof createTestV2TrackEntry>[];
  } = {}
) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/djs-on-air`, () =>
      HttpResponse.json(opts.onAir ?? [])
    ),
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json(opts.entries ?? [])
    )
  );
  // forceRefetch: true matters beyond the first call in a test — RTK Query's
  // query thunk `condition()` skips re-fetching an already-fulfilled cache
  // entry for an unchanged (here: void) arg, so a second primeCaches() call
  // meant to change what the cache says would otherwise silently no-op and
  // leave the first call's data in place.
  await store
    .dispatch(
      flowsheetApi.endpoints.whoIsLive.initiate(undefined, {
        forceRefetch: true,
      })
    )
    .unwrap();
  await store
    .dispatch(
      flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
        forceRefetch: true,
      })
    )
    .unwrap();
}

describe("useOpenShowHandoff (direct, real flowsheetApi cache)", () => {
  beforeEach(() => {
    mockUseRegistry.mockReturnValue({ loading: false, info: CURRENT_USER });
  });

  it("returns the open show when someone else is genuinely on air with a resolvable show", async () => {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({
          show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW,
          add_time: "2026-08-28T12:00:00.000Z",
        }),
      ],
    });

    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });

    expect(result.current()).toEqual({
      showId: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW,
      djNames: ["dj sue"],
      lastLoggedAt: "2026-08-28T12:00:00.000Z",
    });
  });

  it("reads the cache at press time, not at render time", async () => {
    const store = createTestStore();
    // Rendered against an EMPTY cache deliberately. The hook opens no
    // subscription of its own, so nothing re-renders it when the poll lands —
    // meaning a render-time snapshot would never see the collision that
    // arrives afterwards, and would answer null forever. Reading at press time
    // is the entire reason this hook returns a function instead of a value,
    // and it is invisible to any test that primes before rendering.
    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });
    expect(result.current()).toBeNull();

    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({
          show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW,
          add_time: "2026-08-28T12:00:00.000Z",
        }),
      ],
    });

    // Same function object, new answer.
    expect(result.current()).toEqual({
      showId: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW,
      djNames: ["dj sue"],
      lastLoggedAt: "2026-08-28T12:00:00.000Z",
    });
  });

  it("returns null while the registry has not resolved a user yet", async () => {
    mockUseRegistry.mockReturnValue({ loading: true, info: null });
    const store = createTestStore();
    await primeCaches(store, {
      // A genuine collision is present, so the only thing that can suppress
      // the prompt here is the unresolved user — a handoff has nobody to put
      // on air until the registry answers.
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });

    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });

    expect(result.current()).toBeNull();
  });

  it("returns null when nobody is on air", async () => {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });

    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });

    expect(result.current()).toBeNull();
  });

  it("returns null when the asking DJ is already a member of what's on air", async () => {
    const store = createTestStore();
    await primeCaches(store, {
      // The roster includes the asking DJ themselves, alongside someone else —
      // a re-pressed toggle, which the server also no-ops. Prompting here
      // would put the dialog on the ordinary one-click path.
      onAir: [
        createTestOnAirDJResponse({
          id: CURRENT_USER.id,
          dj_name: CURRENT_USER.dj_name,
        }),
        createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" }),
      ],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });

    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });

    expect(result.current()).toBeNull();
  });

  it("returns null when someone else is on air but nothing resolves to a real show id", async () => {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      // An orphan row (server-side show_id: null, converted to the -1
      // sentinel) — someone is on air, but there is no show id to bind a
      // takeover to.
      entries: [createTestV2TrackEntry({ show_id: null })],
    });

    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });

    expect(result.current()).toBeNull();
  });
});

describe("useOpenShowHandoff — program from the getCurrentShow cache", () => {
  const SPECIALTY = {
    id: 4,
    slug: "sunday-jazz",
    name: "Sunday Jazz",
    short_name: "Jazz",
    logs_playcuts: true,
  };
  const SHOW_ID = TEST_ENTITY_IDS.SHOW.CURRENT_SHOW;

  // A different program, so a leak of the cached show's program is visible.
  const OTHER_SPECIALTY = {
    id: 9,
    slug: "late-night-drone",
    name: "Late Night Drone",
    short_name: "Drone",
    logs_playcuts: false,
  };

  // `on_air.show_id` names the cached show itself, so `getCurrentShow`'s
  // selector finds the row and the cache really holds that show. Whether it is
  // the show the handoff is about is what the id guard in useOpenShowHandoff
  // decides.
  const warmCurrentShow = async (
    store: AppStore,
    shows: { id: number }[]
  ) => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet`, () =>
        HttpResponse.json({
          entries: [],
          page: 0,
          limit: 1,
          total: 0,
          total_pages: 0,
          on_air: { dj_name: "dj sue", show_id: shows[0].id },
          shows,
        })
      )
    );
    await store.dispatch(flowsheetApi.endpoints.getCurrentShow.initiate());
  };

  beforeEach(() => {
    mockUseRegistry.mockReturnValue({ loading: false, info: CURRENT_USER });
  });

  it.each([
    [
      "a warm cache naming the same show",
      [{ id: SHOW_ID, start_time: "2026-10-19T16:00:00Z", specialty: SPECIALTY, show_name: "Standards" }],
      { specialty: SPECIALTY, showName: "Standards" },
    ],
    [
      "a warm cache naming the same show with no title",
      [{ id: SHOW_ID, start_time: "2026-10-19T16:00:00Z", specialty: SPECIALTY }],
      { specialty: SPECIALTY, showName: null },
    ],
    [
      "a warm cache naming a different show",
      // The cache holds a real other show (the previous one, say, not yet
      // refetched) while the entries cache says the open show is SHOW_ID.
      [{ id: SHOW_ID + 1, start_time: "2026-10-19T16:00:00Z", specialty: OTHER_SPECIALTY, show_name: "Drone Hour" }],
      null,
    ],
    ["a cold cache", undefined, null],
  ])("with %s", async (_name, shows, program) => {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({
          show_id: SHOW_ID,
          add_time: "2026-08-28T12:00:00.000Z",
        }),
      ],
    });
    if (shows) {
      await warmCurrentShow(store, shows);
    }

    const { result } = renderHook(() => useOpenShowHandoff(), {
      wrapper: wrapperFor(store),
    });

    // A mismatch must be the DJ-only handoff, never another show's program.
    // toEqual would pass an explicit `undefined` key, so also check the names.
    const handoff = result.current();
    expect(JSON.stringify(handoff)).not.toContain(OTHER_SPECIALTY.name);
    expect(JSON.stringify(handoff)).not.toContain("Drone Hour");
    expect(result.current()).toEqual({
      showId: SHOW_ID,
      djNames: ["dj sue"],
      lastLoggedAt: "2026-08-28T12:00:00.000Z",
      ...program,
    });
  });
});

describe("useGoLiveHandoff — re-entrancy guard", () => {
  beforeEach(() => {
    mockUseRegistry.mockReturnValue({ loading: false, info: CURRENT_USER });
    mockToastError.mockClear();
  });

  it("keeps the first prompt when requestGoLive is invoked again while it is still open", async () => {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });

    // Typed rather than a bare vi.fn(): if the guard ever regresses so that
    // requestGoLive reaches `await goLive(...)`, an undefined return would
    // throw inside the hook on `outcome.status` and point a reader at outcome
    // handling instead of at the guard that actually broke.
    const goLive = vi.fn(async (): Promise<GoLiveOutcome> => ({ status: "ok" }));
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.requestGoLive();
    });
    expect(result.current.prompt?.handoff.showId).toBe(
      TEST_ENTITY_IDS.SHOW.CURRENT_SHOW
    );
    // The cache already answered the question, so no server round trip.
    expect(goLive).not.toHaveBeenCalled();

    // Re-prime the cache with a DIFFERENT collision entirely, so a second
    // call that actually re-derived its answer would visibly disagree with
    // the first prompt — proving the guard blocks it rather than merely
    // recomputing the same value.
    await primeCaches(store, {
      onAir: [
        createTestOnAirDJResponse({ id: "dj-ronnabyte-1", dj_name: "dj ronnabyte" }),
      ],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.PAST_SHOW }),
      ],
    });

    await act(async () => {
      await result.current.requestGoLive();
    });

    // Still the first show — a stray second press while the prompt is open
    // must be a no-op, not a silent replacement of the pending decision.
    expect(result.current.prompt?.handoff.showId).toBe(
      TEST_ENTITY_IDS.SHOW.CURRENT_SHOW
    );
    expect(goLive).not.toHaveBeenCalled();
  });

  it("blocks a second requestGoLive call while decide() is still awaiting the server", async () => {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });

    // Definitely assigned by the time it is called: the Promise executor runs
    // synchronously on construction, and goLive is invoked before decide()
    // suspends. Asserted rather than optional so that a change which delayed
    // that invocation fails loudly here instead of no-opping into a hang on
    // the await below.
    let resolveGoLive!: (outcome: GoLiveOutcome) => void;
    const goLive = vi.fn(
      () =>
        new Promise<GoLiveOutcome>((resolve) => {
          resolveGoLive = resolve;
        })
    );

    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });

    // Open the prompt from the cache-known collision (no goLive call yet).
    await act(async () => {
      await result.current.requestGoLive();
    });
    expect(result.current.prompt).not.toBeNull();
    expect(goLive).not.toHaveBeenCalled();

    // The DJ answers: decide() sets `deciding` and calls goLive, which hangs
    // until resolveGoLive() is invoked below.
    let decidePromise!: Promise<void>;
    act(() => {
      decidePromise = result.current.decide("join");
    });
    expect(result.current.deciding).toBe(true);
    expect(goLive).toHaveBeenCalledTimes(1);

    // The collision clears from the cache while the decision is in flight
    // (the other DJ's own poll caught up, say). This is the one arrangement
    // that actually distinguishes "the guard stopped it" from "the cache
    // check would have stopped it anyway" (see the sibling test above): with
    // nothing left in the cache, an UNGUARDED second press would fall
    // straight through to a second, undecided goLive() call instead of being
    // swallowed by a now-vacuous cache check.
    await primeCaches(store, { onAir: [], entries: [] });

    // A stray second press (e.g. a double-click, or classic's inline form
    // leaving its submit button live) while the decision is still in flight
    // must not fire a second, UNDECIDED join. Fired without awaiting its
    // completion: goLive() is invoked SYNCHRONOUSLY the instant requestGoLive
    // reaches it (only the settling is async), so the call count is
    // observable immediately regardless of the guard, and awaiting an
    // unguarded call here would otherwise hang this test forever on a
    // promise nothing resolves.
    act(() => {
      void result.current.requestGoLive();
    });
    // Pins the guard as a whole, NOT its `deciding` term specifically: an
    // in-flight decision leaves `prompt` set too (it is cleared only after the
    // await settles), so either half alone still blocks this press. Removing
    // just `deciding` leaves this test green — confirmed by breaking each half
    // in turn. `deciding` is therefore currently redundant here, and both
    // surfaces keep it that way by disabling Cancel while a decision is in
    // flight; the state that would isolate it — prompt cleared, decision still
    // running — is unreachable from either UI. Don't read this assertion as
    // coverage of that term, and don't drop the term on the strength of it.
    // The same applies to `deciding` in decide()'s own `!prompt || deciding`
    // guard, which nothing here pins either: both surfaces disable the answer
    // buttons while a decision is in flight, so a second decide() is likewise
    // unreachable-but-deliberate.
    expect(goLive).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveGoLive({ status: "ok" });
      await decidePromise;
    });
    expect(result.current.deciding).toBe(false);
    expect(result.current.prompt).toBeNull();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe("useGoLiveHandoff — one-tap tag", () => {
  const TAG = { specialty_id: 10, show_name: "Season opener" };
  const ONE_TAP = { tag: TAG, program: "New Science Experience" };

  beforeEach(() => {
    mockUseRegistry.mockReturnValue({ loading: false, info: CURRENT_USER });
  });

  async function openPrompt(
    goLive: (...args: unknown[]) => Promise<GoLiveOutcome>,
    oneTap?: typeof ONE_TAP
  ) {
    const store = createTestStore();
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });
    await act(async () => {
      await result.current.requestGoLive("Aubrey Hearst", oneTap);
    });
    return result;
  }

  it("replays the tag on takeover, with the show name and the handle", async () => {
    const goLive = vi.fn(async (): Promise<GoLiveOutcome> => ({ status: "ok" }));
    const result = await openPrompt(goLive, ONE_TAP);
    expect(result.current.prompt?.program).toBe("New Science Experience");

    await act(async () => {
      await result.current.decide("takeover");
    });

    expect(goLive).toHaveBeenCalledWith(
      "Aubrey Hearst",
      expect.objectContaining({ intent: "takeover" }),
      TAG
    );
  });

  it("sends no tag on join, since the joined show keeps what it is", async () => {
    const goLive = vi.fn(async (): Promise<GoLiveOutcome> => ({ status: "ok" }));
    const result = await openPrompt(goLive, ONE_TAP);

    await act(async () => {
      await result.current.decide("join");
    });

    expect(goLive).toHaveBeenCalledWith(
      "Aubrey Hearst",
      expect.objectContaining({ intent: "join" }),
      undefined
    );
  });

  it("sends the tag on the first attempt when nobody is on the open-show cache", async () => {
    const goLive = vi.fn(async (): Promise<GoLiveOutcome> => ({ status: "ok" }));
    const store = createTestStore();
    await primeCaches(store);
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });
    await act(async () => {
      await result.current.requestGoLive(undefined, ONE_TAP);
    });
    expect(goLive).toHaveBeenCalledWith(undefined, undefined, TAG);
  });

  it("keeps the tag when the server's 409 opens the prompt", async () => {
    const goLive = vi
      .fn<(...args: unknown[]) => Promise<GoLiveOutcome>>()
      .mockResolvedValueOnce({
        status: "conflict",
        handoff: { showId: 7, djNames: ["dj sue"], lastLoggedAt: null },
      })
      .mockResolvedValue({ status: "ok" });
    const store = createTestStore();
    await primeCaches(store);
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });
    await act(async () => {
      await result.current.requestGoLive(undefined, ONE_TAP);
    });
    await act(async () => {
      await result.current.decide("takeover");
    });
    expect(goLive).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ intent: "takeover", expected_show_id: 7 }),
      TAG
    );
  });

  it("carries no tag or program after the usual go live", async () => {
    const goLive = vi.fn(async (): Promise<GoLiveOutcome> => ({ status: "ok" }));
    const result = await openPrompt(goLive);
    expect(result.current.prompt?.program).toBeUndefined();
    await act(async () => {
      await result.current.decide("join");
    });
    expect(goLive).toHaveBeenCalledWith(
      "Aubrey Hearst",
      expect.objectContaining({ intent: "join" }),
      undefined
    );
  });
});

describe("useGoLiveHandoff — a refused program tag", () => {
  const ONE_TAP = { tag: { specialty_id: 10 }, program: "New Science Experience" };
  const refused = async (): Promise<GoLiveOutcome> => ({
    status: "tag-refused",
    message: ONE_TAP_TAG_REFUSED_SENTENCE,
  });

  beforeEach(() => {
    mockToastError.mockClear();
    mockUseRegistry.mockReturnValue({ loading: false, info: CURRENT_USER });
  });

  it("holds the sentence instead of toasting it, and clears it on the next press", async () => {
    const goLive = vi
      .fn<(...args: unknown[]) => Promise<GoLiveOutcome>>()
      .mockImplementationOnce(refused)
      .mockResolvedValue({ status: "ok" });
    const store = createTestStore();
    await primeCaches(store);
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.requestGoLive(undefined, ONE_TAP);
    });
    expect(result.current.refusal).toBe(ONE_TAP_TAG_REFUSED_SENTENCE);
    expect(mockToastError).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.requestGoLive();
    });
    expect(result.current.refusal).toBeNull();
  });

  // A refusal and an open prompt can coexist only through a race: press A has
  // no open show in the cache and is still awaiting the server when the roster
  // changes and press B opens the prompt, then A's 400 lands.
  it("clears a held refusal when a decision starts", async () => {
    let refuseFirstPress: (outcome: GoLiveOutcome) => void = () => {};
    const goLive = vi
      .fn<(...args: unknown[]) => Promise<GoLiveOutcome>>()
      .mockImplementationOnce(
        () => new Promise<GoLiveOutcome>((resolve) => (refuseFirstPress = resolve)),
      )
      .mockResolvedValue({ status: "ok" });
    const store = createTestStore();
    await primeCaches(store);
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });

    let firstPress: Promise<void> = Promise.resolve();
    act(() => {
      firstPress = result.current.requestGoLive(undefined, ONE_TAP);
    });
    await primeCaches(store, {
      onAir: [createTestOnAirDJResponse({ id: "dj-sue-1", dj_name: "dj sue" })],
      entries: [
        createTestV2TrackEntry({ show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW }),
      ],
    });
    await act(async () => {
      await result.current.requestGoLive();
    });
    await act(async () => {
      refuseFirstPress({ status: "tag-refused", message: ONE_TAP_TAG_REFUSED_SENTENCE });
      await firstPress;
    });
    expect(result.current.prompt).not.toBeNull();
    expect(result.current.refusal).toBe(ONE_TAP_TAG_REFUSED_SENTENCE);

    await act(async () => {
      await result.current.decide("join");
    });

    expect(result.current.refusal).toBeNull();
  });

  it("holds the sentence when a takeover decision is refused, and closes the prompt", async () => {
    const goLive = vi
      .fn<(...args: unknown[]) => Promise<GoLiveOutcome>>()
      .mockResolvedValueOnce({
        status: "conflict",
        handoff: { showId: 12, djNames: ["dj sue"], lastLoggedAt: null },
      })
      .mockImplementationOnce(refused);
    const store = createTestStore();
    await primeCaches(store);
    const { result } = renderHook(() => useGoLiveHandoff(goLive), {
      wrapper: wrapperFor(store),
    });
    await act(async () => {
      await result.current.requestGoLive(undefined, ONE_TAP);
    });
    await act(async () => {
      await result.current.decide("takeover");
    });

    expect(result.current.refusal).toBe(ONE_TAP_TAG_REFUSED_SENTENCE);
    expect(result.current.prompt).toBeNull();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
