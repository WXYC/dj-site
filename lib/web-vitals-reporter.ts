import { safeCapture } from "./posthog";

/**
 * Forwards Core Web Vitals (LCP/CLS/INP/FCP/TTFB) to PostHog through the same
 * fail-open `safeCapture` wrapper used for `$pageview` and `csp_violation`
 * so it inherits the optional-service contract and needs no new
 * adapter. Passed to `useReportWebVitals` from TelemetryProvider.
 */

/** Subset of next/web-vitals' `Metric` this reporter forwards. */
export interface WebVitalMetric {
  name: string;
  value: number;
  delta: number;
  id: string;
  rating: "good" | "needs-improvement" | "poor";
  navigationType?: string;
}

// Module-scope so the reference stays stable across renders: a changing
// callback identity makes useReportWebVitals re-report already-seen metrics.
export function reportWebVital(metric: WebVitalMetric): void {
  // `pathname` is read at call time (not threaded through React state) so the
  // callback identity stays stable, yet each vital is attributed to the route
  // it fired on — the whole point being to filter cold-load LCP/TTFB to a
  // specific page like /dashboard/catalog. `navigation_type` separates cold
  // loads (navigate/reload) from warm back/forward restores. SSR-safe:
  // useReportWebVitals only fires in the browser.
  const pathname =
    typeof window === "undefined" ? undefined : window.location.pathname;

  safeCapture("web_vitals", {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
    navigation_type: metric.navigationType,
    pathname,
  });
}
