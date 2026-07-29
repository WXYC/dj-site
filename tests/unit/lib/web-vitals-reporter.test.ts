import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeCapture } from "@/lib/posthog";
import {
  reportWebVital,
  type WebVitalMetric,
} from "@/lib/web-vitals-reporter";

vi.mock("@/lib/posthog", () => ({
  safeCapture: vi.fn(),
}));

function metric(overrides: Partial<WebVitalMetric> = {}): WebVitalMetric {
  return {
    name: "LCP",
    value: 1234.5,
    delta: 1234.5,
    id: "v3-1700000000000-1234567890123",
    rating: "good",
    navigationType: "navigate",
    ...overrides,
  };
}

describe("reportWebVital", () => {
  beforeEach(() => {
    vi.mocked(safeCapture).mockClear();
  });

  it("captures a web_vitals event with the metric fields plus route context", () => {
    reportWebVital(metric());

    expect(safeCapture).toHaveBeenCalledTimes(1);
    expect(safeCapture).toHaveBeenCalledWith("web_vitals", {
      name: "LCP",
      value: 1234.5,
      delta: 1234.5,
      id: "v3-1700000000000-1234567890123",
      rating: "good",
      navigation_type: "navigate",
      // jsdom's default location; in the browser this is the real route so
      // cold-load LCP/TTFB can be filtered to e.g. /dashboard/catalog.
      pathname: "/",
    });
  });

  it("forwards each metric name and rating unchanged", () => {
    reportWebVital(metric({ name: "CLS", value: 0.02, rating: "needs-improvement" }));

    expect(safeCapture).toHaveBeenCalledWith(
      "web_vitals",
      expect.objectContaining({ name: "CLS", value: 0.02, rating: "needs-improvement" })
    );
  });

  it("distinguishes warm back/forward navigations from cold loads", () => {
    reportWebVital(metric({ navigationType: "back-forward" }));

    expect(safeCapture).toHaveBeenCalledWith(
      "web_vitals",
      expect.objectContaining({ navigation_type: "back-forward" })
    );
  });
});
