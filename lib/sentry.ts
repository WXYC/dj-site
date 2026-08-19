import type { Breadcrumb, ErrorEvent } from "@sentry/browser";
import { redactEmails } from "./redact";

type SentrySdk = typeof import("./sentry-sdk");

/**
 * Sentry sink for error reporting. Callers do not use this module directly —
 * `lib/error-reporting.ts` fans every capture out to here and to PostHog.
 *
 * Optional-service contract (CLAUDE.md): the SDK may be unavailable (tests,
 * SSR, missing DSN, failed chunk load), so every path swallows and the app
 * never sees a telemetry failure.
 *
 * The SDK loads via a dynamic `import()` of `./sentry-sdk` — its own deferred
 * chunk rather than the root layout's shared bundle — and that indirection is
 * load-bearing for size; see the note in `sentry-sdk.ts`.
 *
 * Anonymization is enforced here, not left to project settings: no `setUser`
 * is exposed, `beforeSend` strips whatever identity the SDK assembled, and
 * email-shaped strings are redacted before anything leaves the browser.
 * Sentry's ingest still infers IP/geo for JavaScript events, which no SDK
 * option can prevent — the org's "Prevent Storing of IP Addresses" setting is
 * the other half of this guarantee.
 */
let client: SentrySdk | null = null;
// Non-null once a load starts (in-flight OR settled): also the remount /
// double-invocation guard. `loadFailed` records a settled *rejection* so
// captures stop buffering (the buffer would otherwise grow with no flush).
let loading: Promise<void> | null = null;
let loadFailed = false;

// Captures fired before the chunk resolves would otherwise be lost — that
// window includes the highest-value crash class: a root-layout error renders
// app/global-error.tsx in place of the tree containing TelemetryProvider, so
// its capture can arrive before (or instead of) the provider's init. Buffer in
// order and flush once `client` resolves. Bounded so a pathological pre-load
// burst can't grow unboundedly; on overflow the NEWEST capture is dropped,
// preserving the earliest error, which is most likely the root cause.
// Client-only: the buffer is touched solely while `loading` is set, and
// `loading` is only ever set after the `typeof window === "undefined"` bail,
// so SSR never enqueues.
type BufferedCapture = {
  readonly error: Error;
  readonly context?: Record<string, unknown>;
};
const MAX_BUFFERED = 20;
let buffer: BufferedCapture[] = [];

// Sentry truncates tag values at 200 chars and indexes them for search; long
// or structured values belong in `extra` instead.
const MAX_TAG_LENGTH = 200;

/**
 * Splits a context object into searchable tags and the full `extra` payload.
 * Only primitives become tags: `extra` is stored but NOT indexed, so a
 * context like `{ endpoint, status }` would otherwise be invisible to issue
 * search — the exact filtering ("show me every failure of this endpoint")
 * these call sites exist to enable.
 */
function splitContext(context: Record<string, unknown> | undefined): {
  tags: Record<string, string>;
  extra: Record<string, unknown> | undefined;
} {
  const tags: Record<string, string> = {};
  if (!context) return { tags, extra: undefined };
  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) continue;
    const type = typeof value;
    if (type === "string" || type === "number" || type === "boolean") {
      tags[key] = redactEmails(String(value)).slice(0, MAX_TAG_LENGTH);
    }
  }
  return { tags, extra: context };
}

// Exposed to Sentry as `beforeSend`. Deletes user identity outright (the app
// never identifies DJs to telemetry) and redacts email-shaped strings from the
// human-written fields.
function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (typeof event.message === "string") {
    event.message = redactEmails(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === "string") {
      exception.value = redactEmails(exception.value);
    }
  }
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      const userAgent = event.request.headers["User-Agent"];
      event.request.headers =
        userAgent === undefined ? {} : { "User-Agent": userAgent };
    }
  }
  return event;
}

// Exposed to Sentry as `beforeBreadcrumb`. Console breadcrumbs serialize
// whatever was logged, so the same redaction applies to breadcrumb message and
// string data values. Fetch/XHR URL + status stay: catalog search terms are
// music titles, not PII.
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (typeof breadcrumb.message === "string") {
    breadcrumb.message = redactEmails(breadcrumb.message);
  }
  if (breadcrumb.data) {
    for (const [key, value] of Object.entries(breadcrumb.data)) {
      if (typeof value === "string") {
        breadcrumb.data[key] = redactEmails(value);
      }
    }
  }
  return breadcrumb;
}

function send(sentry: SentrySdk, item: BufferedCapture): void {
  try {
    const { tags, extra } = splitContext(item.context);
    sentry.captureException(item.error, { tags, extra });
  } catch {
    // optional-service contract: swallow
  }
}

function flushBuffer(sentry: SentrySdk): void {
  const pending = buffer;
  buffer = [];
  for (const item of pending) send(sentry, item);
}

/**
 * Resolves the environment tag. `NODE_ENV` is "production" for EVERY `next
 * build` — preview deploys included — so it can only distinguish dev from
 * "some deployed build"; the deploy jobs pass the real environment explicitly.
 * An unset variable in a production build therefore reports "unknown" rather
 * than claiming "production": a preview error mislabeled as production is
 * worse than an honestly unlabeled one, since it corrupts the environment
 * filter that production alerting depends on.
 */
function resolveEnvironment(): string {
  const configured = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "unknown" : "development";
}

export function initSentry(): void {
  if (typeof window === "undefined") return;
  // A single in-flight or settled import is cached in `loading`; a rejected
  // load is not retried (a broken chunk host stays broken for the session).
  // Error reporting is best-effort; failing dark beats hammering the host.
  if (loading) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  loading = import("./sentry-sdk")
    .then((sentry) => {
      // A truthy client means another module instance (HMR) already
      // initialized the SDK — adopt it as the sink without re-initializing.
      if (!sentry.getClient()) {
        sentry.init({
          dsn,
          environment: resolveEnvironment(),
          release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
          // Explicit even though it's the default: the no-PII posture of this
          // adapter must not drift with an SDK default change.
          sendDefaultPii: false,
          maxBreadcrumbs: 30,
          beforeSend: scrubEvent,
          beforeBreadcrumb: scrubBreadcrumb,
        });
      }
      client = sentry;
      flushBuffer(sentry);
    })
    .catch(() => {
      // optional-service contract: a failed chunk load must not surface. Mark
      // failed and drop the buffer so it can't accrete for a session that will
      // never flush.
      loadFailed = true;
      buffer = [];
    });
}

/**
 * Reports an already-normalized Error to Sentry. `lib/error-reporting.ts` owns
 * the normalization and is the only intended caller.
 */
export function captureExceptionInSentry(
  error: Error,
  context?: Record<string, unknown>
): void {
  try {
    if (client) {
      send(client, { error, context });
      return;
    }
    // Self-starting: a root-layout crash reaches here without
    // TelemetryProvider ever having mounted, so begin the load now
    // (idempotent via `loading`; inert on SSR or without a DSN).
    if (loading === null && !loadFailed) initSentry();
    if (loading === null || loadFailed) return;
    if (buffer.length >= MAX_BUFFERED) return;
    buffer.push({ error, context });
  } catch {
    // optional-service contract: swallow
  }
}
