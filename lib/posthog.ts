import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (posthog.__loaded) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
  });
}

/**
 * Capture an exception without ever throwing back to the caller. PostHog may
 * be uninitialized (tests, SSR) — the dispatch / request path must not crash
 * because telemetry is unavailable.
 */
export function safeCaptureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  try {
    posthog.captureException(
      err instanceof Error ? err : new Error(String(err)),
      context
    );
  } catch {
    // intentionally swallowed — see jsdoc
  }
}

/** Capture a PostHog event without throwing on uninitialized telemetry. */
export function safeCapture(
  event: string,
  props?: Record<string, unknown>
): void {
  try {
    posthog.capture(event, props);
  } catch {
    // intentionally swallowed — see safeCaptureException
  }
}

export { posthog };
