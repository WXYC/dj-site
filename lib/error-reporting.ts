import { captureExceptionInPostHog } from "./posthog";
import { captureExceptionInSentry, initSentry } from "./sentry";

/**
 * The one entry point for reporting an error. Every boundary, middleware, and
 * listener in the app calls `safeCaptureException`; this module decides where
 * the report goes.
 *
 * Errors go to BOTH sinks (docs/adr/0008). Sentry provides grouping,
 * regression detection, and release triage; PostHog's `$exception` stream
 * backs crash-investigation workflows that predate Sentry here and stay in
 * use, and keeps errors correlatable with the analytics events around them.
 * A consequence worth knowing when reading counts: both SDKs also install
 * their own global handlers, so an unhandled error is recorded by each
 * independently of this function.
 *
 * Neither sink receives PII: the error is normalized here, and each adapter
 * redacts email-shaped text on the way out.
 */
export function initErrorReporting(): void {
  // PostHog initializes through `initTelemetry` (it carries analytics too);
  // only the Sentry sink needs starting here.
  initSentry();
}

export function safeCaptureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  let error: Error;
  try {
    error = err instanceof Error ? err : new Error(String(err));
  } catch {
    // `String(err)` can throw on an object with a hostile `toString`.
    error = new Error("Unserializable error value");
  }
  // Each adapter already swallows its own failures; these guards keep one
  // sink's unexpected throw from suppressing the other's report.
  try {
    captureExceptionInSentry(error, context);
  } catch {
    // optional-service contract: swallow
  }
  try {
    captureExceptionInPostHog(error, context);
  } catch {
    // optional-service contract: swallow
  }
}
