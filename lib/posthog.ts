import type { CaptureResult, PostHog } from "posthog-js";
import { createExceptionGate } from "./exception-gate";
import { redactEmailsDeep } from "./redact";

/**
 * Telemetry is optional (CLAUDE.md optional-service rule): PostHog may be
 * uninitialized (tests, SSR, missing key). Every capture is wrapped so an
 * unavailable SDK fails open and never throws back into the dispatch, request,
 * or render path.
 *
 * PostHog carries product analytics AND its own copy of every error: the
 * `$exception` stream backs established crash-investigation workflows here,
 * and is the only error sink (docs/adr/0009). Callers report errors through
 * `lib/error-reporting.ts`.
 *
 * Nothing here may identify a person: no `identify()` call exists anywhere,
 * autocapture and session recording stay off (both serialize on-screen PII —
 * the admin roster renders DJ names and emails), and `before_send` redacts
 * email-shaped strings from every event, including the exceptions the SDK
 * captures automatically.
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

// Manual `$exception` sends share a hard monthly PostHog cap with every other
// surface, and unlike automatic capture (posthog-js rate-limits that itself)
// they bypass the SDK's limiter. See lib/exception-gate.ts for the two gates.
const exceptionGate = createExceptionGate();

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

/**
 * Exposed to posthog-js as `before_send`. Applies to every event the SDK
 * emits, which is the point: the exceptions it captures automatically (and
 * their `$exception_list` message/stack frames) never pass through this
 * module's own wrappers, so this is the only place their text can be scrubbed.
 */
function scrubEventProperties(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties) return event;
  event.properties = redactEmailsDeep(event.properties) as CaptureResult["properties"];
  return event;
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
          // Unhandled errors keep flowing to the $exception stream that
          // crash investigation here already relies on.
          capture_exceptions: true,
          // Anonymization posture (see module doc): autocapture serializes
          // clicked-element text and recording captures the screen, both of
          // which include DJ names/emails on the roster page; person_profiles
          // is explicit so the no-identify policy is visible at the init site,
          // not just an accident of the default.
          person_profiles: "identified_only",
          autocapture: false,
          disable_session_recording: true,
          before_send: scrubEventProperties,
        });
        // Literal `process.env.NEXT_PUBLIC_*` reads so the bundler inlines them.
        const environment = process.env.NEXT_PUBLIC_ENVIRONMENT;
        const release = process.env.NEXT_PUBLIC_RELEASE;
        if (environment || release) {
          posthog.register({
            ...(environment && { environment }),
            ...(release && { release }),
          });
        }
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
      bufferCapture({ method: "capture", args: [event, props] });
    }
  } catch {
    // optional-service contract: swallow
  }
}

/**
 * Reports an already-normalized Error to PostHog as `$exception`.
 * `lib/error-reporting.ts` owns the normalization and is the only intended
 * caller; the property shape matches what the SDK's automatic capture emits,
 * so both arrive as the same event type.
 *
 * Gated before both the direct send and the pre-load buffer (so buffered
 * errors count too): 60 s dedupe, then a per-page-load token bucket of 20,
 * refilling one token per 30 minutes. Drops are counted and reported as
 * `dropped_since_last` on the next sent event, never as events of their own.
 * `label` is an optional call-site constant (a string literal) that joins the
 * dedupe key. Automatic
 * capture (`capture_exceptions: true`) is left to the SDK's own limiter.
 */
export function captureExceptionInPostHog(
  error: Error,
  context?: Record<string, unknown>,
  label?: string
): void {
  try {
    if (!exceptionGate.admit(error, context, label)) {
      return;
    }
    const droppedSinceLast = exceptionGate.takeDropped();
    const props = droppedSinceLast > 0 ? { ...context, dropped_since_last: droppedSinceLast } : context;
    if (client) {
      client.captureException(error, props);
    } else {
      bufferCapture({ method: "captureException", args: [error, props] });
    }
  } catch {
    // optional-service contract: swallow
  }
}

export function safeCapturePageview(url: string): void {
  safeCapture("$pageview", { $current_url: url });
}
