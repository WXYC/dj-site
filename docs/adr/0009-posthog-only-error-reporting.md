# PostHog is the only error tracker

Supersedes [ADR 0008](0008-dual-sink-error-reporting.md).

Client-side errors go to PostHog's `$exception` stream and nowhere else. WXYC is leaving Sentry across the stack, and Backend-Service's email alert replaces the Sentry default rule as the paging path. The Sentry half of ADR 0008 is removed: `lib/sentry.ts`, `lib/sentry-sdk.ts`, `@sentry/browser`, the Sentry ingest origin in the CSP `connect-src`, and the `NEXT_PUBLIC_SENTRY_*` build variables.

`lib/error-reporting.ts` stays the single entry point (`safeCaptureException`). It normalizes the error once and hands it to `lib/posthog.ts`, which remains an application-owned, fail-open adapter. The optional `label` parameter (a call-site string literal, never runtime data) still joins the exception gate's dedupe key. PostHog's SDK installs its own global handler, so an unhandled error is recorded independently of this function.

Anonymization is unchanged and now rests on PostHog alone: no `identify()` call exists, `person_profiles: "identified_only"`, `autocapture: false`, `disable_session_recording: true`, and a `before_send` that redacts email-shaped text from every event.

Deploy context moves to PostHog super-properties. `lib/posthog.ts` registers `environment` and `release` right after `posthog.init`, from `NEXT_PUBLIC_ENVIRONMENT` and `NEXT_PUBLIC_RELEASE` (set by the CI deploy jobs to production/preview and the commit SHA), only when set.

## Consequences

- Grouping, regression detection, and release association are whatever PostHog Error Tracking provides; the Sentry-specific tag mirroring of `context` is gone.
- Production builds still publish public source maps (`productionBrowserSourceMaps: true`). Whether PostHog resolves dj-site stack traces from them is not verified here; if frames do not resolve, uploading maps with the PostHog CLI in the deploy job is the follow-up.
- Server-side errors still have no sink beyond Cloudflare Workers Logs; `instrumentation.ts`'s `onRequestError` remains a documented no-op seam.
- Counts of unhandled errors are now a single stream, so historic Sentry-vs-PostHog reconciliation no longer applies.
