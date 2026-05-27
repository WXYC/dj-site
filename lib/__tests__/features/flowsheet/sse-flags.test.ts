import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isFlowsheetSSEDashboardEnabled,
  isFlowsheetSSELiveViewEnabled,
} from "@/lib/features/flowsheet/sse-flags";

/**
 * Tier 1 — Test #4 (gate half): exhaustively assert the SSE feature-flag
 * helpers' coercion logic.
 *
 * `NEXT_PUBLIC_*` env vars are inlined as the string the user wrote at
 * Next.js build time, so the helpers' only job is to recognise the truthy
 * values. A regression here would either silently disable SSE in prod when
 * the flag IS flipped, or silently enable it when it ISN'T.
 *
 * Complements `SSESubscription.test.tsx`, which covers the component-level
 * gate (the consumer that calls these helpers).
 */
describe("sse-flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isFlowsheetSSEDashboardEnabled", () => {
    it.each<[string | undefined, boolean]>([
      ["true", true],
      ["1", true],
      ["false", false],
      ["0", false],
      ["", false],
      [undefined, false],
      ["TRUE", false], // case-sensitive on purpose
      ["yes", false],
    ])("returns %j for NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=%j", (value, expected) => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", value ?? "");
      expect(isFlowsheetSSEDashboardEnabled()).toBe(expected);
    });
  });

  describe("isFlowsheetSSELiveViewEnabled", () => {
    it.each<[string | undefined, boolean]>([
      ["true", true],
      ["1", true],
      ["false", false],
      ["0", false],
      ["", false],
      [undefined, false],
      ["TRUE", false],
      ["yes", false],
    ])("returns %j for NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED=%j", (value, expected) => {
      vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED", value ?? "");
      expect(isFlowsheetSSELiveViewEnabled()).toBe(expected);
    });
  });

  it("dashboard and live-view flags are independent", () => {
    vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED", "false");
    expect(isFlowsheetSSEDashboardEnabled()).toBe(true);
    expect(isFlowsheetSSELiveViewEnabled()).toBe(false);
  });
});
