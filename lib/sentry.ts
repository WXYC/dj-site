import type { Breadcrumb, ErrorEvent } from "@sentry/browser";

type SentrySdk = typeof import("@sentry/browser");

/**
 * Error reporting is optional (CLAUDE.md optional-service rule): Sentry may be
 * uninitialized (tests, SSR, missing DSN). Every capture is wrapped so an
 * unavailable SDK fails open and never throws back into the dispatch, request,
 * or render path.
 *
 * `@sentry/browser` is loaded via a dynamic `import()` inside
 * `initErrorReporting` rather than a top-level static import, so the SDK ships
 * in its own deferred chunk instead of the root layout's shared bundle that
 * every route parses before hydration.
 *
 * Anonymization is a hard requirement, enforced at this boundary: no
 * `setUser` is exposed, `beforeSend` strips whatever user/request identity the
 * SDK assembled, and email-shaped strings are redacted from messages and
 * breadcrumbs before anything leaves the app (backend error messages can echo
 * emails during login and roster operations). SDK-side scrubbing is the strong
 * layer; Sentry's server-side scrubbing remains only a backstop.
 */
let client: SentrySdk | null = null;
// Non-null once a load starts (in-flight OR settled): also the remount /
// double-invocation guard. `loadFailed` records a settled *rejection* so
// wrappers stop buffering (the buffer would otherwise grow with no flush to
// drain it).
let loading: Promise<void> | null = null;
let loadFailed = false;

// Captures fired before the chunk resolves would otherwise be lost — that
// window includes the highest-value crash class: a root-layout error renders
// app/global-error.tsx in place of the tree containing TelemetryProvider, so
// its capture can arrive before (or instead of) the provider's init. Buffer in
// order and flush once `client` resolves. Bounded so a pathological pre-load
// burst can't grow unboundedly; on overflow the NEWEST capture is dropped,
// preserving the earliest error, which is most likely the root cause. Client
// -only: the buffer is touched solely while `loading` is set, and `loading` is
// only ever set after the `typeof window === "undefined"` bail, so SSR never
// enqueues.
type BufferedCapture = {
  readonly error: Error;
  readonly context?: Record<string, unknown>;
};
const MAX_BUFFERED = 20;
let buffer: BufferedCapture[] = [];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, "[email]");
}

// Exposed to Sentry as `beforeSend`. Deletes user identity outright (the app
// never identifies DJs to telemetry — Sentry's server-side IP inference for
// JS-platform events is disabled separately in org settings) and redacts
// email-shaped strings from the human-written fields.
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
// whatever was logged, so the same email redaction applies to breadcrumb
// message and string data values. Fetch/XHR URL + status stay: catalog search
// terms are music titles, not PII.
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

function flushBuffer(sentry: SentrySdk): void {
  const pending = buffer;
  buffer = [];
  for (const item of pending) {
    try {
      sentry.captureException(item.error, { extra: item.context });
    } catch {
      // optional-service contract: swallow
    }
  }
}

export function initErrorReporting(): void {
  if (typeof window === "undefined") return;
  // A single in-flight or settled import is cached in `loading`; a rejected
  // load is not retried (a broken chunk host stays broken for the session).
  // Error reporting is best-effort; failing dark beats hammering the host.
  if (loading) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  loading = import("@sentry/browser")
    .then((Sentry) => {
      // getClient() truthy means another module instance (HMR) already
      // initialized the SDK — adopt it as the sink without re-initializing.
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn,
          environment:
            process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
            (process.env.NODE_ENV === "production"
              ? "production"
              : "development"),
          release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
          // Explicit even though it's the default: the no-PII posture of this
          // adapter must not drift with an SDK default change.
          sendDefaultPii: false,
          maxBreadcrumbs: 30,
          beforeSend: scrubEvent,
          beforeBreadcrumb: scrubBreadcrumb,
        });
      }
      client = Sentry;
      flushBuffer(Sentry);
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
      client.captureException(error, { extra: context });
    } else {
      // Self-starting: a root-layout crash reaches here without
      // TelemetryProvider ever having mounted, so begin the load now
      // (idempotent via `loading`; inert on SSR or without a DSN).
      if (loading === null && !loadFailed) initErrorReporting();
      if (loading === null || loadFailed) return;
      if (buffer.length >= MAX_BUFFERED) return;
      buffer.push({ error, context });
    }
  } catch {
    // optional-service contract: swallow
  }
}
