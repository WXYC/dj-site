import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import {
  FLOWSHEET_POLL_FAST_MS,
  FLOWSHEET_POLL_SLOW_MS,
} from "@/lib/features/flowsheet/constants";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  liveUpdatesConnectionRequested,
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionStateChanged,
  liveUpdatesSlice,
} from "@/lib/features/flowsheet/live-updates-slice";
import { makeStore } from "@/lib/store";
import {
  useFlowsheetPollingInterval,
  useSSEConnection,
} from "@/src/hooks/useSSEConnection";

function makeWrapper() {
  const store = makeStore();
  const dispatched: { type: string }[] = [];
  const realDispatch = store.dispatch;
  store.dispatch = ((action: { type: string }) => {
    dispatched.push(action);
    return realDispatch(action);
  }) as typeof store.dispatch;

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(Provider, { store, children });
  }
  return { store, dispatched, Wrapper };
}

describe("useSSEConnection", () => {
  it("dispatches connectionRequested on mount and released on unmount", () => {
    const { store, dispatched, Wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useSSEConnection(), {
      wrapper: Wrapper,
    });

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: liveUpdatesConnectionRequested.type,
      })
    );
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(store.getState())
    ).toBe(1);

    unmount();

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: liveUpdatesConnectionReleased.type,
      })
    );
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(store.getState())
    ).toBe(0);
  });

  it("ref-counts two mounts through the same Provider", () => {
    const { store, Wrapper } = makeWrapper();
    const h1 = renderHook(() => useSSEConnection(), { wrapper: Wrapper });
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(store.getState())
    ).toBe(1);
    const h2 = renderHook(() => useSSEConnection(), { wrapper: Wrapper });
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(store.getState())
    ).toBe(2);
    h1.unmount();
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(store.getState())
    ).toBe(1);
    h2.unmount();
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(store.getState())
    ).toBe(0);
  });
});

describe("useFlowsheetPollingInterval", () => {
  it("polls fast when SSE is disconnected and slow when connected", () => {
    const { store, Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      () => useFlowsheetPollingInterval(),
      { wrapper: Wrapper }
    );

    expect(result.current).toBe(FLOWSHEET_POLL_FAST_MS);

    act(() => {
      store.dispatch(liveUpdatesConnectionStateChanged("connected"));
    });
    rerender();
    expect(result.current).toBe(FLOWSHEET_POLL_SLOW_MS);
  });

  it("suspends polling while a flowsheet drag is in flight, regardless of SSE state", () => {
    const { store, Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      () => useFlowsheetPollingInterval(),
      { wrapper: Wrapper }
    );

    act(() => {
      store.dispatch(flowsheetSlice.actions.setIsDragging(true));
    });
    rerender();
    expect(result.current).toBe(0);

    // Still suspended when SSE connects mid-drag.
    act(() => {
      store.dispatch(liveUpdatesConnectionStateChanged("connected"));
    });
    rerender();
    expect(result.current).toBe(0);

    // Restores the SSE-appropriate cadence once the drag ends.
    act(() => {
      store.dispatch(flowsheetSlice.actions.setIsDragging(false));
    });
    rerender();
    expect(result.current).toBe(FLOWSHEET_POLL_SLOW_MS);
  });
});
