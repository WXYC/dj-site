import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/lib/test-utils";
import SSESubscription from "./SSESubscription";

/**
 * Gate test for the SSE feature flags. Asserts the component short-circuits
 * `useSSEConnection` when its surface flag is off — observed via
 * `liveUpdates.refCount` (1 on connect-requested, 0 otherwise).
 *
 * NEXT_PUBLIC_* is inlined at Next.js build time, but vitest reads
 * `process.env` at runtime so `vi.stubEnv` works here.
 */
describe("<SSESubscription>", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('surface="dashboard"', () => {
    it("does not request the SSE connection when flag is off", () => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", "");
      const { store } = renderWithProviders(<SSESubscription surface="dashboard" />);
      expect(store.getState().liveUpdates.refCount).toBe(0);
    });

    it("requests the SSE connection when flag is true", () => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", "true");
      const { store } = renderWithProviders(<SSESubscription surface="dashboard" />);
      expect(store.getState().liveUpdates.refCount).toBe(1);
    });

    it("releases the SSE connection on unmount", () => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", "true");
      const { store, unmount } = renderWithProviders(
        <SSESubscription surface="dashboard" />
      );
      expect(store.getState().liveUpdates.refCount).toBe(1);
      unmount();
      expect(store.getState().liveUpdates.refCount).toBe(0);
    });
  });

  describe('surface="live"', () => {
    it("does not request the SSE connection when flag is off", () => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED", "");
      const { store } = renderWithProviders(<SSESubscription surface="live" />);
      expect(store.getState().liveUpdates.refCount).toBe(0);
    });

    it("requests the SSE connection when flag is true", () => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED", "true");
      const { store } = renderWithProviders(<SSESubscription surface="live" />);
      expect(store.getState().liveUpdates.refCount).toBe(1);
    });
  });

  it("flags are independent — dashboard true, live off doesn't connect live", () => {
    vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED", "");
    const { store } = renderWithProviders(<SSESubscription surface="live" />);
    expect(store.getState().liveUpdates.refCount).toBe(0);
  });
});
