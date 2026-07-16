import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeviceAuthTokenErrorCode } from "@wxyc/shared/dtos";
import {
  interpretTokenPoll,
  pollDeviceToken,
  requestDeviceCode,
  type PollOutcome,
} from "@/lib/features/authentication/device-auth";

// device-auth.ts imports `authBaseURL` from ./client, which constructs the
// better-auth client at module load; stub the plugins so the import is cheap.
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({})),
}));
vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(),
  emailOTPClient: vi.fn(),
  usernameClient: vi.fn(),
  jwtClient: vi.fn(),
  organizationClient: vi.fn(),
}));

describe("interpretTokenPoll", () => {
  it("treats a 400 authorization_pending as a non-terminal 'pending' poll", () => {
    const outcome = interpretTokenPoll(400, {
      error: DeviceAuthTokenErrorCode.authorization_pending,
      error_description: "Authorization pending",
    });

    expect(outcome).toEqual({ kind: "pending" });
  });

  it("treats a 400 slow_down as a non-terminal 'slow_down' poll", () => {
    const outcome = interpretTokenPoll(400, {
      error: DeviceAuthTokenErrorCode.slow_down,
      error_description: "Slow down",
    });

    expect(outcome).toEqual({ kind: "slow_down" });
  });

  it("treats a 200 with an access_token as 'success', carrying the token", () => {
    const token = {
      access_token: "sess_abc123",
      token_type: "Bearer" as const,
      expires_in: 43200,
      scope: "",
    };

    const outcome = interpretTokenPoll(200, token);

    expect(outcome).toEqual({ kind: "success", token });
  });

  it("treats any 200 as success even when the body did not parse (null)", () => {
    // A truncated/empty 200 still means the grant issued and the cookie is set;
    // a signed-in DJ must not be shown an error. pollDeviceToken yields
    // body:null on a parse failure.
    expect(interpretTokenPoll(200, null)).toEqual({ kind: "success", token: {} });
  });

  it("treats a 200 with an empty access_token as success (200 = grant issued)", () => {
    const token = {
      access_token: "",
      token_type: "Bearer" as const,
      expires_in: 43200,
      scope: "",
    };

    expect(interpretTokenPoll(200, token)).toEqual({ kind: "success", token });
  });

  it("treats a 400 expired_token as the terminal 'expired' state", () => {
    const outcome = interpretTokenPoll(400, {
      error: DeviceAuthTokenErrorCode.expired_token,
      error_description: "Device code expired",
    });

    expect(outcome).toEqual({ kind: "expired" });
  });

  it("treats a 400 access_denied as the terminal 'denied' state", () => {
    const outcome = interpretTokenPoll(400, {
      error: DeviceAuthTokenErrorCode.access_denied,
      error_description: "Sign-in declined on phone",
    });

    expect(outcome).toEqual({ kind: "denied" });
  });

  it.each([
    { status: 500, code: DeviceAuthTokenErrorCode.server_error },
    { status: 400, code: DeviceAuthTokenErrorCode.invalid_request },
    { status: 400, code: DeviceAuthTokenErrorCode.invalid_grant },
  ])(
    "treats $status $code as a terminal 'error' that surfaces the code",
    ({ status, code }) => {
      const outcome = interpretTokenPoll(status, {
        error: code,
        error_description: "boom",
      });

      expect(outcome).toEqual({ kind: "error", code });
    },
  );

  it("treats an unrecognized error code as a terminal 'error'", () => {
    const outcome = interpretTokenPoll(400, {
      error: "totally_unexpected",
      error_description: "???",
    });

    expect(outcome).toEqual({ kind: "error" });
  });

  // The Record key type is `DeviceAuthTokenErrorCode`, so adding a member to the
  // shared enum without mapping it here fails to compile — a contract-drift guard.
  // Iterating the const's own values (not string literals) proves the function
  // branches on the typed enum.
  it("maps every DeviceAuthTokenErrorCode member to a defined outcome kind", () => {
    const expectedKind: Record<DeviceAuthTokenErrorCode, PollOutcome["kind"]> = {
      [DeviceAuthTokenErrorCode.authorization_pending]: "pending",
      [DeviceAuthTokenErrorCode.slow_down]: "slow_down",
      [DeviceAuthTokenErrorCode.expired_token]: "expired",
      [DeviceAuthTokenErrorCode.access_denied]: "denied",
      [DeviceAuthTokenErrorCode.invalid_request]: "error",
      [DeviceAuthTokenErrorCode.invalid_grant]: "error",
      [DeviceAuthTokenErrorCode.server_error]: "error",
    };

    for (const code of Object.values(DeviceAuthTokenErrorCode)) {
      expect(interpretTokenPoll(400, { error: code }).kind).toBe(
        expectedKind[code],
      );
    }
  });
});

describe("requestDeviceCode", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs a snake_case client_id to /device/code and returns the parsed response", async () => {
    const codeResponse = {
      device_code: "dev_123",
      user_code: "WDPL-XK9R",
      verification_uri: "https://dj.wxyc.org/auth/device",
      verification_uri_complete:
        "https://dj.wxyc.org/auth/device?user_code=WDPL-XK9R",
      expires_in: 300,
      interval: 5,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(codeResponse),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await requestDeviceCode("dj-site");

    expect(result).toEqual(codeResponse);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/device/code");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(init.body)).toEqual({ client_id: "dj-site" });
  });
});

describe("pollDeviceToken", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs the RFC 8628 snake_case token body to /device/token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ access_token: "t" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await pollDeviceToken("dev_123", "dj-site");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/device/token");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(init.body)).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: "dev_123",
      client_id: "dj-site",
    });
  });

  it("passes the status and parsed body through unchanged on a 400 polling state", async () => {
    const errorBody = {
      error: DeviceAuthTokenErrorCode.authorization_pending,
      error_description: "Authorization pending",
    };
    global.fetch = vi.fn().mockResolvedValue({
      status: 400,
      json: () => Promise.resolve(errorBody),
    }) as unknown as typeof fetch;

    const result = await pollDeviceToken("dev_123", "dj-site");

    expect(result).toEqual({ status: 400, body: errorBody });
  });
});
