# PostHog is the only error tracker

Supersedes [ADR 0008](0008-dual-sink-error-reporting.md).

Client-side errors go to PostHog's `$exception` stream and nowhere else. WXYC is leaving Sentry across the stack, and Backend-Service's email alert replaces the Sentry default rule as the paging path. The Sentry half of ADR 0008 is removed: `lib/sentry.ts`, `lib/sentry-sdk.ts`, `@sentry/browser`, the Sentry ingest origin in the CSP `connect-src`, and the `NEXT_PUBLIC_SENTRY_*` build variables.

`lib/error-reporting.ts` stays the single entry point (`safeCaptureException`). It normalizes the error once and hands it to `lib/posthog.ts`, which remains an application-owned, fail-open adapter. The optional `label` parameter (a call-site string literal, never runtime data) still joins the exception gate's dedupe key. PostHog's SDK installs its own global handler, so an unhandled error is recorded independently of this function. A report that arrives before telemetry has started (a root-layout crash reaching `app/global-error.tsx` never mounts `TelemetryProvider`) starts the SDK load itself and is buffered until it resolves.

Anonymization is unchanged and now rests on PostHog alone: no `identify()` call exists, `person_profiles: "identified_only"`, `autocapture: false`, `disable_session_recording: true`, and a `before_send` that redacts email-shaped text from every event.

Deploy context moves to PostHog super-properties. `lib/posthog.ts` registers `environment` and `release` right after `posthog.init`, from `NEXT_PUBLIC_ENVIRONMENT` and `NEXT_PUBLIC_RELEASE` (set by the CI deploy jobs to production/preview and the commit SHA), only when set.

## Consequences

- Grouping, regression detection, and release association are whatever PostHog Error Tracking provides; the Sentry-specific tag mirroring of `context` is gone.
- Production stack frames resolve in PostHog from the publicly served source maps, verified against production `$exception` events (4,405 of 4,429 between 2026-07-23 and 2026-10-21 carry frames resolved to `turbopack:///[project]/...` sources; see the [issue comment](https://github.com/WXYC/dj-site/issues/2359#issuecomment-6327431406)). This holds only while `productionBrowserSourceMaps` stays `true` and the maps stay public; Turbopack map names differ from chunk names, so each map is found through its chunk's `sourceMappingURL`. Turning public maps off would first need a PostHog CLI upload step in the deploy job.
- Server-side errors still have no sink beyond Cloudflare Workers Logs; `instrumentation.ts`'s `onRequestError` remains a documented no-op seam.
- Counts of unhandled errors are now a single stream, so historic Sentry-vs-PostHog reconciliation no longer applies.
