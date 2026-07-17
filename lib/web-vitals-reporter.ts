import { safeCapture } from "./posthog";

/**
 * Forwards Core Web Vitals (LCP/CLS/INP/FCP/TTFB) to PostHog through the same
 * fail-open `safeCapture` wrapper used for `$pageview` and `csp_violation`
 * (#961), so it inherits the optional-service contract and needs no new
 * adapter. Passed to `useReportWebVitals` from TelemetryProvider.
 */

/** Subset of next/web-vitals' `Metric` this reporter forwards. */
export interface WebVitalMetric {
  name: string;
  value: number;
  id: string;
  rating: "good" | "needs-improvement" | "poor";
}

// Module-scope so the reference stays stable across renders: a changing
// callback identity makes useReportWebVitals re-report already-seen metrics.
export function reportWebVital(metric: WebVitalMetric): void {
  safeCapture("web_vitals", {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating,
  });
}
