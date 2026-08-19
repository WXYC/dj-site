import type { Instrumentation } from "next";
import { safeCaptureException } from "@/lib/error-reporting";

/**
 * Single server-observability entry point.
 *
 * No server-side error-reporting client is warranted yet: telemetry is an
 * optional adapter (CLAUDE.md) and both sinks are browser-only here, so
 * `register` is an intentional no-op. Add server setup here if a workerd-side
 * client is ever introduced (see docs/adr/0008 for why it isn't yet).
 */
export function register(): void {}

/**
 * Forwards server-side errors (Server Components, Route Handlers, Server
 * Actions) to the existing fail-open `safeCaptureException` wrapper — no new
 * integration path.
 *
 * Alerting bucket, for future call sites deciding where an error belongs:
 *   - Backend-Service-origin failures (the one hard external dependency per
 *     CLAUDE.md; e.g. surfaced from lib/features/backend.ts's fetchBaseQuery
 *     wrapper) are alerting-worthy — anything reaching `onRequestError` is a
 *     real server failure in this bucket.
 *   - Optional-adapter failures (PostHog, Sentry et al.) stay informational:
 *     they fail open at their `safeCapture*` wrapper and never propagate here,
 *     so this handler never needs to demote them.
 *
 * `safeCaptureException` no-ops server-side (both SDKs load via browser-only
 * dynamic imports) — the fail-open contract holds; the tags below are carried
 * on the event for wherever a server sink is later attached.
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
