import type { PostHog } from "posthog-js";

/**
 * Telemetry is optional (CLAUDE.md optional-service rule): PostHog may be
 * uninitialized (tests, SSR, missing key). Every capture is wrapped so an
 * unavailable SDK fails open and never throws back into the dispatch, request,
 * or render path.
 *
 * `posthog-js` is loaded via a dynamic `import()` inside `initTelemetry` (#972)
 * rather than a top-level static import, so the client library ships in its own
 * deferred chunk instead of the root layout's shared bundle that every route
 * parses before hydration.
 */
let client: PostHog | null = null;
// Non-null once a load starts (in-flight OR settled): also the StrictMode
// re-entry guard. `loadFailed` records a settled *rejection* so wrappers stop
// buffering (the buffer would otherwise grow with no flush to drain it).
let loading: Promise<void> | null = null;
let loadFailed = false;

// Captures fired before the chunk resolves would otherwise be lost — this is
// the whole cold-session window: the first $pageview, TTFB/FCP web-vitals, and
// INP/CLS that only emit on pagehide (bounce visits). Buffer them in order and
// flush once `client` resolves. Bounded so a pathological pre-load burst can't
// grow unboundedly; on overflow the NEWEST event is dropped, preserving the
// earliest, highest-value events (first pageview). Client-only: the buffer is
// touched solely while `loading` is set, and `loading` is only ever set after
// the `typeof window === "undefined"` bail, so SSR never enqueues.
type BufferedCapture =
  | { readonly method: "capture"; readonly args: readonly [string, Record<string, unknown>?] }
  | { readonly method: "captureException"; readonly args: readonly [Error, Record<string, unknown>?] };
const MAX_BUFFERED = 20;
let buffer: BufferedCapture[] = [];

function bufferCapture(item: BufferedCapture): void {
  // No load in flight (SSR, missing key) or a failed load: no-op so nothing
  // accumulates without a flush to drain it.
  if (loading === null || loadFailed) return;
  if (buffer.length >= MAX_BUFFERED) return;
  buffer.push(item);
}

function flushBuffer(ph: PostHog): void {
  const pending = buffer;
  buffer = [];
  for (const item of pending) {
    try {
      if (item.method === "capture") ph.capture(...item.args);
      else ph.captureException(...item.args);
    } catch {
      // optional-service contract: swallow
    }
  }
}

export function initTelemetry(): void {
  if (typeof window === "undefined") return;
  // A single in-flight or settled import is cached in `loading`; a rejected
  // load is not retried (a broken `-assets` chunk host stays broken for the
  // session, and TelemetryProvider mounts once so there is no natural retrigger
  // anyway). Telemetry is best-effort; failing dark beats hammering the host.
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
      flushBuffer(posthog);
    })
    .catch(() => {
      // optional-service contract: a failed chunk load must not surface. Mark
      // failed and drop the buffer so it can't accrete for a session that will
      // never flush.
      loadFailed = true;
      buffer = [];
    });
}

export function safeCaptureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  try {
    const error = err instanceof Error ? err : new Error(String(err));
    if (client) {
      client.captureException(error, context);
    } else {
      bufferCapture({ method: "captureException", args: [error, context] });
    }
  } catch {
    // optional-service contract: swallow
  }
}

export function safeCapture(
  event: string,
  props?: Record<string, unknown>
): void {
  try {
    if (client) {
      client.capture(event, props);
    } else {
      bufferCapture({ method: "capture", args: [event, props] });
    }
  } catch {
    // optional-service contract: swallow
  }
}

export function safeCapturePageview(url: string): void {
  safeCapture("$pageview", { $current_url: url });
}
