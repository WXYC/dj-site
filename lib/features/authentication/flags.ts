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

/**
 * Gates the MANAGER-facing station-signup surface: the "Signup Passcode"
 * segment in the admin roster page's view switcher and the StationSignupPanel
 * it reveals (reveal/rotate/revoke of the shared passcode). Distinct from
 * NEXT_PUBLIC_STATION_SIGNUP_ENABLED, which gates the DJ-facing signup form —
 * this one gates only the administrator's passcode controls, and is meant to be
 * turned on FIRST so the first passcode can be minted before DJs can sign up
 * (mint-before-flip). While off, the switcher shows the roster alone with no
 * toggle, so a manager never reaches a panel whose reveal/rotate would error
 * out because Backend-Service's STATION_PASSCODE_KEY is not yet set.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED
 * to "true" (or "1") once STATION_PASSCODE_KEY is configured on the auth
 * service in that environment.
 */
export function isStationSignupAdminEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED;
  return envValue === "true" || envValue === "1";
}
