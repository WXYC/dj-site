import {
  DeviceAuthCodeRequest,
  DeviceAuthCodeResponse,
  DeviceAuthTokenErrorCode,
  DeviceAuthTokenRequest,
  DeviceAuthTokenResponse,
} from "@wxyc/shared/dtos";
import { authBaseURL } from "./client";

/**
 * The decision a single `/auth/device/token` poll resolves to.
 *
 * RFC 8628 delivers the non-terminal polling states (`authorization_pending`,
 * `slow_down`) and most terminal states as HTTP 400s, not 2xx — so the caller
 * cannot branch on `response.ok` alone. `interpretTokenPoll` collapses the
 * `(status, body)` pair into this small union; the polling loop acts on `kind`
 * and never re-inspects the raw wire shape.
 */
export type PollOutcome =
  | { kind: "pending" }
  | { kind: "slow_down" }
  | { kind: "success"; token: DeviceAuthTokenResponse }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "error"; code?: DeviceAuthTokenErrorCode | "network" };

/**
 * Map an `/auth/device/token` HTTP response to a {@link PollOutcome}.
 *
 * Branches exclusively on {@link DeviceAuthTokenErrorCode} const members, never
 * on raw string literals, so a contract change surfaces as a type error.
 */
export function interpretTokenPoll(status: number, body: unknown): PollOutcome {
  // RFC 8628: any 200 from the token endpoint means the grant was issued and
  // the session cookie is now set — so a 200 is success by status alone, even
  // if the body did not parse (`pollDeviceToken` yields `body: null` on a
  // truncated/empty 200). Gating on a truthy `access_token` would misreport a
  // genuinely signed-in DJ as an error. The token is not consumed downstream
  // (the hook re-reads the user via `getSession`); it is carried for completeness.
  if (status === 200) {
    return { kind: "success", token: (body ?? {}) as DeviceAuthTokenResponse };
  }

  const error = (body as { error?: unknown } | null)?.error;

  if (error === DeviceAuthTokenErrorCode.authorization_pending) {
    return { kind: "pending" };
  }

  if (error === DeviceAuthTokenErrorCode.slow_down) {
    return { kind: "slow_down" };
  }

  if (error === DeviceAuthTokenErrorCode.expired_token) {
    return { kind: "expired" };
  }

  if (error === DeviceAuthTokenErrorCode.access_denied) {
    return { kind: "denied" };
  }

  return isDeviceAuthTokenErrorCode(error)
    ? { kind: "error", code: error }
    : { kind: "error" };
}

const TOKEN_ERROR_CODES = new Set<string>(
  Object.values(DeviceAuthTokenErrorCode),
);

function isDeviceAuthTokenErrorCode(
  value: unknown,
): value is DeviceAuthTokenErrorCode {
  return typeof value === "string" && TOKEN_ERROR_CODES.has(value);
}

/**
 * POST `/auth/device/code` to begin a device-authorization flow.
 *
 * The body is the snake_case {@link DeviceAuthCodeRequest} (`client_id` only —
 * WXYC's shared-computer flow identifies the DJ later, at `/device/approve`).
 * Throws on a non-2xx response; the caller surfaces an error state.
 */
export async function requestDeviceCode(
  clientId: string,
): Promise<DeviceAuthCodeResponse> {
  const body: DeviceAuthCodeRequest = { client_id: clientId };

  const response = await fetch(`${authBaseURL}/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to start device authorization (${response.status})`);
  }

  return (await response.json()) as DeviceAuthCodeResponse;
}

/** The fixed RFC 8628 device-flow grant type. */
const DEVICE_CODE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:device_code" as const;

/**
 * POST one `/auth/device/token` poll.
 *
 * Returns the raw `{ status, body }` without judging it — RFC 8628 delivers
 * polling/terminal states as 400s, so the decision is left to
 * {@link interpretTokenPoll}. The body is the snake_case
 * {@link DeviceAuthTokenRequest}. A `json()` parse failure yields `body: null`.
 */
export async function pollDeviceToken(
  deviceCode: string,
  clientId: string,
): Promise<{ status: number; body: unknown }> {
  const body: DeviceAuthTokenRequest = {
    grant_type: DEVICE_CODE_GRANT_TYPE,
    device_code: deviceCode,
    client_id: clientId,
  };

  const response = await fetch(`${authBaseURL}/device/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  return { status: response.status, body: parsed };
}
