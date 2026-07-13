import type { APIRequestContext, APIResponse } from "@playwright/test";
import type {
  DeviceAuthApproveRequest,
  DeviceAuthDenyRequest,
} from "@wxyc/shared/dtos";

/**
 * The "phone" side of the RFC 8628 QR sign-in flow, for the two-context e2e
 * spec (`e2e/tests/auth/qr-signin.spec.ts`). The shared browser (Context A)
 * polls `/auth/device/token`; a *separate* authenticated principal (Context B,
 * the phone) claims and then approves/denies the user code. These helpers are
 * the Context-B calls, mirroring Backend-Service's integration recipe in
 * `tests/integration/device-authorization.spec.js`.
 *
 * Pass the phone context's own `request` (`context.request`) so the session
 * cookie from its `storageState` attaches automatically — the `dj2.json` /
 * `member.json` session cookie is scoped to `domain=localhost` (port-agnostic),
 * so it is sent to the auth service even though login happened on the frontend
 * port. See the auth-base resolution note below.
 *
 * Casing asymmetry (already flagged in #785 and in the @wxyc/shared DTOs):
 * `/device/code` and `/device/token` bodies are snake_case, but `/device/approve`
 * and `/device/deny` bodies are camelCase `{ userCode }`.
 */

/**
 * Resolve the auth-service base URL (no trailing `/auth`) for the phone's
 * device-flow calls. The phone targets the auth service (`:8084`) directly
 * rather than dj-site's same-origin `/auth` proxy (`app/auth/[...path]/route.ts`,
 * which the browser side uses): hitting the auth service directly is the
 * simplest reliable target and doesn't depend on the dj-site origin, and the
 * `dj2.json`/`member.json` session cookie is `domain=localhost` (port-agnostic)
 * so it attaches regardless of port. Mirrors `getAuthServiceBaseUrl()` in
 * `e2e/fixtures/auth.fixture.ts`.
 */
export function authServiceBaseUrl(): string {
  const authUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (authUrl) {
    // e.g. "http://localhost:8084/auth" -> "http://localhost:8084"
    return authUrl.replace(/\/auth\/?$/, "");
  }
  const authPort = process.env.E2E_AUTH_PORT;
  if (authPort) {
    return `http://localhost:${authPort}`;
  }
  throw new Error(
    "device-auth e2e helper: set NEXT_PUBLIC_BETTER_AUTH_URL or E2E_AUTH_PORT " +
      "(exported by scripts/e2e-local.sh and the CI workflow)."
  );
}

/**
 * Claim a pending user code as the authenticated principal.
 *
 * `GET /auth/device?user_code=<code>` reads the session from the request and,
 * if the row has no `userId`, atomically binds `userId = session.user.id`.
 * `/device/approve` and `/device/deny` both require the row to be claimed by the
 * same session first — approving an unclaimed row 400s.
 */
export function claimDeviceCode(
  request: APIRequestContext,
  userCode: string
): Promise<APIResponse> {
  return request.get(
    `${authServiceBaseUrl()}/auth/device?user_code=${encodeURIComponent(userCode)}`
  );
}

/**
 * Approve a claimed user code. On success the plugin flips the row to
 * `approved` and the shared browser's next `/device/token` poll returns a
 * session. A non-DJ principal is rejected here with a 403 `access_denied`
 * (Backend-Service's role gate runs before the flip) and the row is un-claimed,
 * so a legitimate DJ can still approve the same code — see the S1 contract in
 * `Backend-Service/shared/authentication/src/device-authorization.ts`.
 */
export function approveDeviceCode(
  request: APIRequestContext,
  userCode: string
): Promise<APIResponse> {
  const body: DeviceAuthApproveRequest = { userCode };
  return request.post(`${authServiceBaseUrl()}/auth/device/approve`, {
    data: body,
  });
}

/**
 * Deny a claimed user code. The plugin flips the row to `denied` (a terminal
 * state, unlike the non-DJ-approve reset), so the shared browser's next
 * `/device/token` poll returns `access_denied`.
 */
export function denyDeviceCode(
  request: APIRequestContext,
  userCode: string
): Promise<APIResponse> {
  const body: DeviceAuthDenyRequest = { userCode };
  return request.post(`${authServiceBaseUrl()}/auth/device/deny`, {
    data: body,
  });
}
