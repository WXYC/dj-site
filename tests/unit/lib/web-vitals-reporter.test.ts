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
    id: "v3-1700000000000-1234567890123",
    rating: "good",
    ...overrides,
  };
}

describe("reportWebVital", () => {
  beforeEach(() => {
    vi.mocked(safeCapture).mockClear();
  });

  it("captures a web_vitals event with the metric fields", () => {
    reportWebVital(metric());

    expect(safeCapture).toHaveBeenCalledTimes(1);
    expect(safeCapture).toHaveBeenCalledWith("web_vitals", {
      name: "LCP",
      value: 1234.5,
      id: "v3-1700000000000-1234567890123",
      rating: "good",
    });
  });

  it("forwards each metric name and rating unchanged", () => {
    reportWebVital(metric({ name: "CLS", value: 0.02, rating: "needs-improvement" }));

    expect(safeCapture).toHaveBeenCalledWith(
      "web_vitals",
      expect.objectContaining({ name: "CLS", value: 0.02, rating: "needs-improvement" })
    );
  });
});
