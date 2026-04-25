import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";

const mockTrigger = vi.fn();
const mockQueryState = {
  data: undefined as unknown,
  isFetching: false,
  isError: false,
};

vi.mock("@/lib/features/playlist-search/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/features/playlist-search/api")>(
      "@/lib/features/playlist-search/api"
    );
  return {
    ...actual,
    useLazySearchPlaylistsQuery: () =>
      [mockTrigger, mockQueryState] as unknown as ReturnType<
        typeof actual.useLazySearchPlaylistsQuery
      >,
  };
});

import { usePlaylistSearch } from "./playlistSearchHooks";

function createWrapper(store?: AppStore) {
  const s = store ?? makeStore();
  return {
    store: s,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store: s, children }),
  };
}

beforeEach(() => {
  mockTrigger.mockReset();
  mockQueryState.data = undefined;
  mockQueryState.isFetching = false;
  mockQueryState.isError = false;
});

describe("usePlaylistSearch", () => {
  describe("default-recent behavior", () => {
    it("fires an empty-query request on mount so the page shows recent tracks", async () => {
      const { wrapper } = createWrapper();

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalled());
      expect(mockTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ q: "", page: 0 })
      );
    });

    it("re-fires the empty query when the user clears all rows back to default", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      // Initial empty fire
      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      // User types something
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "autechre" },
          })
        );
      });
      await waitFor(() =>
        expect(mockTrigger).toHaveBeenCalledWith(
          expect.objectContaining({ q: "autechre" })
        )
      );

      // User clears it
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "" },
          })
        );
      });
      await waitFor(() => {
        const lastCall = mockTrigger.mock.calls.at(-1);
        expect(lastCall?.[0]).toEqual(expect.objectContaining({ q: "" }));
      });
    });
  });

  describe("partial-query debounce", () => {
    it("does not fire while the user has typed only a single character", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      // Wait for the initial empty fire so we can isolate the next behavior
      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "a" },
          })
        );
      });

      // Give effects a tick to settle, then assert no new call
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockTrigger).toHaveBeenCalledTimes(1);
    });

    it("fires once the user types a second character", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "au" },
          })
        );
      });

      await waitFor(() =>
        expect(mockTrigger).toHaveBeenCalledWith(
          expect.objectContaining({ q: "au" })
        )
      );
    });
  });
});
