import { safeCapture } from "./posthog";

/**
 * Forwards Content-Security-Policy violations to PostHog so the Report-Only
 * rollout (#631) gathers real-user signal instead of relying on individual
 * DevTools consoles. Installed once per page from TelemetryProvider.
 */

// Dedupe per (violatedDirective, blockedURI-origin) per page session so a hot
// violation (e.g. one blocked origin hit on every render) can't flood
// telemetry; the cap bounds the pathological many-distinct-origins case.
const reportedKeys = new Set<string>();
const MAX_REPORTS_PER_SESSION = 50;

/**
 * Reduce blockedURI to its origin: full URLs can carry query tokens or other
 * sensitive path segments that must not ship to telemetry. Non-URL keywords
 * the browser reports ("inline", "eval", "data", "") pass through unchanged.
 */
function blockedURIOrigin(blockedURI: string): string {
  try {
    return new URL(blockedURI).origin;
  } catch {
    return blockedURI;
  }
}

/** Reduce documentURI to its path for the same query-token reason. */
function documentURIPath(documentURI: string): string {
  try {
    return new URL(documentURI).pathname;
  } catch {
    return documentURI;
  }
}

type CspViolation = Pick<
  SecurityPolicyViolationEvent,
  "violatedDirective" | "blockedURI" | "documentURI" | "disposition"
>;

export function handleSecurityPolicyViolation(event: CspViolation): void {
  const blockedOrigin = blockedURIOrigin(event.blockedURI);
  const key = `${event.violatedDirective}|${blockedOrigin}`;

  if (reportedKeys.has(key) || reportedKeys.size >= MAX_REPORTS_PER_SESSION) {
    return;
  }
  reportedKeys.add(key);

  safeCapture("csp_violation", {
    violatedDirective: event.violatedDirective,
    blockedURI: blockedOrigin,
    documentURI: documentURIPath(event.documentURI),
    disposition: event.disposition,
  });
}

let installed = false;

export function installCspViolationReporter(): void {
  if (typeof document === "undefined" || installed) return;
  installed = true;
  document.addEventListener(
    "securitypolicyviolation",
    handleSecurityPolicyViolation
  );
}

/** Test-only escape hatch: clears the dedupe set and installed flag. */
export function resetCspViolationReporterForTests(): void {
  reportedKeys.clear();
  installed = false;
}
