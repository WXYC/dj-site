/**
 * Rotation feature flags read from public Next.js env vars.
 *
 * Values are inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init.
 */

/**
 * Gates the Rotation Admin surface (rotation card management, the free-form
 * filing bench) reached from the catalog admin screens.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_ROTATION_ADMIN_ENABLED to
 * "true" (or "1") once Backend-Service is serving the rotation cards and
 * filings endpoints in that environment.
 */
export function isRotationAdminEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_ROTATION_ADMIN_ENABLED;
  return envValue === "true" || envValue === "1";
}
