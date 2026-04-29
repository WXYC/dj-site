import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { FLOWSHEET_METADATA_REFETCH_DELAY_MS } from "@/lib/features/flowsheet/constants";
import { scheduleDeferredFlowsheetRefetch } from "@/lib/features/flowsheet/deferred-refetch";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";

/**
 * #476 (option 2): the deferred-refetch helper. Surgical refetch — when the
 * timer fires, refetch only the now-playing row and patch the corresponding
 * entry in the infinite-query cache, avoiding the heavy
 * `invalidateTags(["Flowsheet"])` shape that would refetch every loaded
 * page.
 */

const NOW_PLAYING_THUNK = Symbol("getNowPlaying.initiate.thunk");
const UPDATE_QUERY_DATA_THUNK = Symbol("updateQueryData.thunk");

interface CapturedDispatch {
  dispatch: ReturnType<typeof vi.fn>;
  initiateSpy: ReturnType<typeof vi.spyOn>;
  updateQueryDataSpy: ReturnType<typeof vi.spyOn>;
  setNowPlayingResult: (
    r: FlowsheetEntry | null | (() => Promise<FlowsheetEntry | null>)
  ) => void;
}

function setupCapturedDispatch(
  initial: FlowsheetEntry | null | (() => Promise<FlowsheetEntry | null>)
): CapturedDispatch {
  let result = initial;

  const initiateSpy = vi
    .spyOn(flowsheetApi.endpoints.getNowPlaying, "initiate")
    .mockReturnValue(NOW_PLAYING_THUNK as unknown as ReturnType<
      typeof flowsheetApi.endpoints.getNowPlaying.initiate
    >);

  const updateQueryDataSpy = vi
    .spyOn(flowsheetApi.util, "updateQueryData")
    .mockReturnValue(UPDATE_QUERY_DATA_THUNK as unknown as ReturnType<
      typeof flowsheetApi.util.updateQueryData
    >);

  const dispatch = vi.fn((action: unknown) => {
    if (action === NOW_PLAYING_THUNK) {
      const value = typeof result === "function" ? result() : result;
      const promise = value instanceof Promise ? value : Promise.resolve(value);
      return { unwrap: () => promise };
    }
    if (action === UPDATE_QUERY_DATA_THUNK) {
      return UPDATE_QUERY_DATA_THUNK;
    }
    return action;
  });

  return {
    dispatch,
    initiateSpy,
    updateQueryDataSpy,
    setNowPlayingResult: (r) => {
      result = r;
    },
  };
}

describe("scheduleDeferredFlowsheetRefetch — #476 deferred metadata refetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules a setTimeout with FLOWSHEET_METADATA_REFETCH_DELAY_MS and returns nothing synchronously", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const { dispatch } = setupCapturedDispatch(null);

    const ret = scheduleDeferredFlowsheetRefetch(dispatch as never, 42);

    expect(ret).toBeUndefined();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy.mock.calls[0][1]).toBe(FLOWSHEET_METADATA_REFETCH_DELAY_MS);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch before the configured delay elapses", () => {
    const { dispatch } = setupCapturedDispatch(null);

    scheduleDeferredFlowsheetRefetch(dispatch as never, 42);
    vi.advanceTimersByTime(FLOWSHEET_METADATA_REFETCH_DELAY_MS - 1);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches a forced getNowPlaying refetch when the timer fires", async () => {
    const { dispatch, initiateSpy } = setupCapturedDispatch(null);

    scheduleDeferredFlowsheetRefetch(dispatch as never, 42);
    await vi.advanceTimersByTimeAsync(FLOWSHEET_METADATA_REFETCH_DELAY_MS);
    await vi.runAllTimersAsync();

    expect(initiateSpy).toHaveBeenCalledTimes(1);
    expect(initiateSpy).toHaveBeenCalledWith(undefined, { forceRefetch: true });
  });

  it("patches the infinite-query cache when the now-playing result matches the entry id", async () => {
    const enriched = { id: 42, play_order: 1 } as unknown as FlowsheetEntry;
    const { dispatch, updateQueryDataSpy } = setupCapturedDispatch(enriched);

    scheduleDeferredFlowsheetRefetch(dispatch as never, 42);
    await vi.advanceTimersByTimeAsync(FLOWSHEET_METADATA_REFETCH_DELAY_MS);
    await vi.runAllTimersAsync();

    expect(updateQueryDataSpy).toHaveBeenCalledTimes(1);
    const [endpointName, queryArg] = updateQueryDataSpy.mock.calls[0];
    expect(endpointName).toBe("getInfiniteEntries");
    expect(queryArg).toBeUndefined();
  });

  it("does NOT patch the cache when the now-playing result is for a different entry id (stale latest)", async () => {
    const otherEntry = { id: 999, play_order: 1 } as unknown as FlowsheetEntry;
    const { dispatch, updateQueryDataSpy } = setupCapturedDispatch(otherEntry);

    scheduleDeferredFlowsheetRefetch(dispatch as never, 42);
    await vi.advanceTimersByTimeAsync(FLOWSHEET_METADATA_REFETCH_DELAY_MS);
    await vi.runAllTimersAsync();

    expect(updateQueryDataSpy).not.toHaveBeenCalled();
  });

  it("does NOT patch the cache when getNowPlaying returns null", async () => {
    const { dispatch, updateQueryDataSpy } = setupCapturedDispatch(null);

    scheduleDeferredFlowsheetRefetch(dispatch as never, 42);
    await vi.advanceTimersByTimeAsync(FLOWSHEET_METADATA_REFETCH_DELAY_MS);
    await vi.runAllTimersAsync();

    expect(updateQueryDataSpy).not.toHaveBeenCalled();
  });

  it("swallows refetch errors and does not throw out of the timer callback", async () => {
    const failing = () => Promise.reject(new Error("network down"));
    const { dispatch, updateQueryDataSpy } = setupCapturedDispatch(failing);

    scheduleDeferredFlowsheetRefetch(dispatch as never, 42);

    // Throwing inside the timer would propagate as an unhandled rejection;
    // advanceTimersByTimeAsync would reject. Awaiting it directly verifies
    // the helper swallows the error cleanly.
    await vi.advanceTimersByTimeAsync(FLOWSHEET_METADATA_REFETCH_DELAY_MS);
    await vi.runAllTimersAsync();

    expect(updateQueryDataSpy).not.toHaveBeenCalled();
  });
});
