// Email addresses are the one PII class that reliably leaks into error text:
// Backend-Service messages echo them during login, onboarding, and roster
// operations, and console breadcrumbs serialize whatever was logged. Both
// telemetry sinks redact with this shared helper so the two can't drift.
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, "[email]");
}

// Bounded so a deeply nested or cyclic payload can't stall the capture path;
// past the limit the value is dropped rather than emitted unredacted.
const MAX_DEPTH = 5;

/**
 * Redacts every string reachable in a JSON-ish value. Non-plain objects
 * (Error, Date, class instances) are returned untouched — walking them risks
 * mangling structures the SDK relies on, and error *messages* are redacted
 * explicitly at each call site.
 */
export function redactEmailsDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactEmails(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactEmailsDeep(item, depth + 1));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = redactEmailsDeep(item, depth + 1);
  }
  return result;
}
