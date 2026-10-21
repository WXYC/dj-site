import { captureExceptionInPostHog } from "./posthog";

/**
 * The one entry point for reporting an error. Every boundary, middleware, and
 * listener in the app calls `safeCaptureException`; PostHog's `$exception`
 * stream is the only sink (docs/adr/0009). The SDK also installs its own
 * global handlers, so an unhandled error is recorded independently of this
 * function.
 *
 * The error is normalized here and the adapter redacts email-shaped text on
 * the way out.
 */
/**
 * `label` is an optional call-site constant (a string literal) that joins the
 * PostHog exception gate's dedupe key, so two call sites reporting the same
 * error text are not suppressed as one. Never derive it from runtime data.
 */
export function safeCaptureException(
  err: unknown,
  context?: Record<string, unknown>,
  label?: string
): void {
  let error: Error;
  try {
    error = err instanceof Error ? err : new Error(String(err));
  } catch {
    // `String(err)` can throw on an object with a hostile `toString`.
    error = new Error("Unserializable error value");
  }
  // The adapter already swallows its own failures; this guard covers an
  // unexpected throw.
  try {
    captureExceptionInPostHog(error, context, label);
  } catch {
    // optional-service contract: swallow
  }
}
