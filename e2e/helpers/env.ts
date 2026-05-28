/**
 * Validate that required env vars are present, throwing with a guidance
 * message naming the caller and the missing keys. Used by e2e helpers
 * that consume `scripts/e2e-local.sh` / CI workflow exports.
 */
export function requireEnv(
  caller: string,
  names: readonly string[]
): Record<string, string> {
  const missing = names.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `${caller}: missing required env vars: ${missing.join(", ")}. ` +
        `Ensure scripts/e2e-local.sh (or the CI workflow) exports them before running Playwright.`
    );
  }
  const out: Record<string, string> = {};
  for (const k of names) out[k] = process.env[k]!;
  return out;
}
