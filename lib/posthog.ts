import type { PostHog } from "posthog-js";

/**
 * Telemetry is optional (CLAUDE.md optional-service rule): PostHog may be
 * uninitialized (tests, SSR, missing key). Every capture is wrapped so an
 * unavailable SDK fails open and never throws back into the dispatch, request,
 * or render path.
 *
 * `posthog-js` is loaded via a dynamic `import()` inside `initTelemetry` (#972)
 * rather than a top-level static import, so the ~heavy client library ships in
 * its own deferred chunk instead of the root layout's shared bundle that every
 * route parses before hydration. Until that import resolves — SSR, tests, a
 * missing key, or the window between hydration and chunk load — `client` is
 * null and every capture no-ops (events fired in that window are dropped, not
 * queued; the pre-load window is short and these are best-effort signals).
 */
let client: PostHog | null = null;
let loading: Promise<void> | null = null;

export function initTelemetry(): void {
  if (typeof window === "undefined") return;
  // Guard against re-entry (React StrictMode double-invokes effects): a single
  // in-flight or settled import is cached in `loading`.
  if (loading) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: host,
          capture_pageview: false,
          capture_pageleave: true,
          capture_exceptions: true,
        });
      }
      client = posthog;
    })
    .catch(() => {
      // optional-service contract: a failed chunk load must not surface
    });
}

export function safeCaptureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  try {
    client?.captureException(
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
    client?.capture(event, props);
  } catch {
    // optional-service contract: swallow
  }
}

export function safeCapturePageview(url: string): void {
  safeCapture("$pageview", { $current_url: url });
}
