import posthog from "posthog-js";

export function initTelemetry(): void {
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
 * Telemetry is optional (CLAUDE.md optional-service rule): PostHog may be
 * uninitialized (tests, SSR, missing key). Every capture is wrapped so an
 * unavailable SDK fails open and never throws back into the dispatch, request,
 * or render path.
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
    // optional-service contract: swallow
  }
}

export function safeCapture(
  event: string,
  props?: Record<string, unknown>
): void {
  try {
    posthog.capture(event, props);
  } catch {
    // optional-service contract: swallow
  }
}

export function safeCapturePageview(url: string): void {
  safeCapture("$pageview", { $current_url: url });
}
