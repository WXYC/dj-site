import type { PostHog } from "posthog-js";

/**
 * Telemetry is optional (CLAUDE.md optional-service rule): PostHog may be
 * uninitialized (tests, SSR, missing key). Every capture is wrapped so an
 * unavailable SDK fails open and never throws back into the dispatch, request,
 * or render path.
 *
 * PostHog owns product analytics only — error reporting lives in
 * `lib/sentry.ts` (docs/adr/0008). Nothing here may identify a person:
 * no `identify()` call exists anywhere, and the init options below keep
 * autocapture, session recording, and exception payloads off because each can
 * serialize on-screen or in-message PII (the admin roster renders DJ
 * names/emails).
 *
 * `posthog-js` is loaded via a dynamic `import()` inside `initTelemetry`
 * rather than a top-level static import, so the client library ships in its own
 * deferred chunk instead of the root layout's shared bundle that every route
 * parses before hydration.
 */
let client: PostHog | null = null;
// Non-null once a load starts (in-flight OR settled): also the remount /
// double-invocation guard. `loadFailed` records a settled *rejection* so
// wrappers stop buffering (the buffer would otherwise grow with no flush to
// drain it).
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
type BufferedCapture = {
  readonly args: readonly [string, Record<string, unknown>?];
};
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
      ph.capture(...item.args);
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
          // Anonymization posture (see module doc): errors belong to Sentry;
          // autocapture serializes clicked-element text and recording captures
          // the screen, both of which include DJ names/emails on the roster
          // page; person_profiles is explicit so the no-identify policy is
          // visible at the init site, not just an accident of the default.
          capture_exceptions: false,
          person_profiles: "identified_only",
          autocapture: false,
          disable_session_recording: true,
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

export function safeCapture(
  event: string,
  props?: Record<string, unknown>
): void {
  try {
    if (client) {
      client.capture(event, props);
    } else {
      bufferCapture({ args: [event, props] });
    }
  } catch {
    // optional-service contract: swallow
  }
}

export function safeCapturePageview(url: string): void {
  safeCapture("$pageview", { $current_url: url });
}
