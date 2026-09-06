/**
 * Authentication feature flags read from public Next.js env vars.
 *
 * Values are inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init.
 */

/**
 * Gates the RFC 8628 QR ("device authorization") sign-in method on the login
 * screen: the "Sign in with a QR code" entry links and the restore of a stored
 * "qr" login preference.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_QR_LOGIN_ENABLED to "true"
 * (or "1") once Backend-Service is serving the device-authorization endpoints
 * in that environment. While off, nothing can navigate to the QR stage, so the
 * client never requests a device code.
 */
export function isQrLoginEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_QR_LOGIN_ENABLED;
  return envValue === "true" || envValue === "1";
}

/**
 * Gates the DJ-facing station-signup form: the passcode-then-account-details
 * flow reached from a link on the normal login form. This is the CLIENT half
 * of a two-flag rollout — Backend-Service has its own independent
 * STATION_SIGNUP_ENABLED gate on POST /auth/wxyc/station-signup, and turning
 * this one on ahead of that serves a real DJ a plain 404, which
 * StationSignupForm renders as a distinct "not available" state rather than a
 * generic failure.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_STATION_SIGNUP_ENABLED to
 * "true" (or "1") once Backend-Service is serving the endpoint in that
 * environment.
 */
export function isStationSignupEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_STATION_SIGNUP_ENABLED;
  return envValue === "true" || envValue === "1";
}
