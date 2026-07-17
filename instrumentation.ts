import type { Instrumentation } from "next";
import { safeCaptureException } from "@/lib/posthog";

/**
 * Single server-observability entry point (#960).
 *
 * No server-side PostHog node client is warranted yet: telemetry is an
 * optional adapter (CLAUDE.md) and PostHog is browser-only here, so `register`
 * is an intentional no-op. Add server setup here if a node client is ever
 * introduced.
 */
export function register(): void {}

/**
 * Forwards server-side errors (Server Components, Route Handlers, Server
 * Actions) to the existing fail-open `safeCaptureException` wrapper — no new
 * PostHog integration path.
 *
 * Alerting bucket, for future call sites deciding where an error belongs:
 *   - Backend-Service-origin failures (the one hard external dependency per
 *     CLAUDE.md; e.g. surfaced from lib/features/backend.ts's fetchBaseQuery
 *     wrapper) are alerting-worthy — anything reaching `onRequestError` is a
 *     real server failure in this bucket.
 *   - Optional-adapter failures (PostHog et al.) stay informational: they
 *     fail open at their `safeCapture*` wrapper and never propagate here, so
 *     this handler never needs to demote them.
 *
 * `safeCaptureException` no-ops server-side (posthog-js is loaded via a
 * browser-only dynamic import, #972) — the fail-open contract holds; the tags
 * below are carried on the event for wherever a server sink is later attached.
 */
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context
) => {
  safeCaptureException(err, {
    path: request.path,
    routerKind: context.routerKind,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
