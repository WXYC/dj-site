import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/lib/test-utils";
import SSESubscription from "./SSESubscription";

/**
 * Tier 1 — Test #4 (consumer half): assert the component-level flag gate
 * actually short-circuits when the surface flag is off.
 *
 * Strategy: `useSSEConnection` dispatches `liveUpdatesConnectionRequested`
 * on mount, which bumps `liveUpdates.refCount` from 0 to 1. So if the gate
 * works, an off-flag mount leaves refCount at 0; an on-flag mount lands it
 * at 1. This catches the "someone removed the gate" regression at the
 * SSESubscription seam — the next layer down (the listener middleware
 * actually opening an EventSource) is covered separately by
 * `live-updates-listener.test.ts`.
 *
 * NEXT_PUBLIC_* env vars are inlined at Next.js build time, but vitest
 * doesn't run a Next.js build, so `vi.stubEnv` works at runtime here. In
 * production CI, the flag-off-stays-off equivalent is provided by tests #1–3
 * running against a flag-ON build (any regression where SSE silently fires
 * with the flag off would surface as duplicate handshake requests in test #4
 * of #661 once that lands, and as a connection-count step change in PostHog
 * during the #663 staged rollout).
 */
describe("<SSESubscription>", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

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
