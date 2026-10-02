/**
 * Rotation feature flags read from public Next.js env vars.
 *
 * Values are inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init.
 */

/**
 * Gates the Rotation Admin surface: the modern routes under
 * `/dashboard/admin/rotation` and the modern sidebar's "Rotation" entry they
 * are reached from. Also gates two DJ-facing displays outside that surface:
 * in catalog search results (classic and modern), the rotation bin + card
 * location that replaces the call number for a release in rotation; and on
 * the modern album card, the release's definitive Listen links. See
 * docs/env-vars.md for the routes.
 *
 * Flip on by setting NEXT_PUBLIC_ROTATION_ADMIN_ENABLED to "true" (or "1").
 */
export function isRotationAdminEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_ROTATION_ADMIN_ENABLED;
  return envValue === "true" || envValue === "1";
}
