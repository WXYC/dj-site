/**
 * Rotation feature flags read from public Next.js env vars.
 *
 * Values are inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init.
 */

/**
 * Gates the Rotation Admin surface -- rotation card management and the
 * free-form filing bench -- reached from the modern sidebar's "Rotation"
 * entry, plus the DJ-facing rotation displays in catalog search and on the
 * modern album card. See docs/env-vars.md for the full route list.
 *
 * Flip on by setting NEXT_PUBLIC_ROTATION_ADMIN_ENABLED to "true" (or "1").
 */
export function isRotationAdminEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_ROTATION_ADMIN_ENABLED;
  return envValue === "true" || envValue === "1";
}
