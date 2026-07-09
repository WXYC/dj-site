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
