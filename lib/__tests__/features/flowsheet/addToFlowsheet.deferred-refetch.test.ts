import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flowsheetApi,
  scheduleDeferredFlowsheetRefetch,
} from "@/lib/features/flowsheet/api";
import { FLOWSHEET_METADATA_REFETCH_DELAY_MS } from "@/lib/features/flowsheet/constants";

/**
 * #476 (option 2): after a successful addToFlowsheet, schedule a deferred
 * refetch of the Flowsheet tag so the row picks up backend's async LML
 * metadata enrichment without waiting for the next 60s polling cycle.
 *
 * The helper is unit-tested in isolation here; the wiring at the
 * `addToFlowsheet` mutation's queryFulfilled-success branch is verified by
 * inspection.
 */
describe("scheduleDeferredFlowsheetRefetch — #476 deferred metadata refetch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules a setTimeout with FLOWSHEET_METADATA_REFETCH_DELAY_MS", () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const dispatch = vi.fn();

    scheduleDeferredFlowsheetRefetch(dispatch);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      FLOWSHEET_METADATA_REFETCH_DELAY_MS
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches invalidateTags(['Flowsheet']) when the timer fires", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();

    scheduleDeferredFlowsheetRefetch(dispatch);
    expect(dispatch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(FLOWSHEET_METADATA_REFETCH_DELAY_MS);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    // RTK Query's invalidateTags returns a thunk action with the tag list as payload
    expect(action).toEqual(flowsheetApi.util.invalidateTags(["Flowsheet"]));
  });

  it("does not fire before the configured delay elapses", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();

    scheduleDeferredFlowsheetRefetch(dispatch);
    vi.advanceTimersByTime(FLOWSHEET_METADATA_REFETCH_DELAY_MS - 1);

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("FLOWSHEET_METADATA_REFETCH_DELAY_MS", () => {
  it("is set to 2000ms — covers typical LML happy-path latency without overshooting AC", () => {
    // Backend-Service#628 latency bound: typical LML 200-800ms,
    // p100 ~5s. Two-second delay is the right sweet spot.
    expect(FLOWSHEET_METADATA_REFETCH_DELAY_MS).toBe(2000);
  });
});
