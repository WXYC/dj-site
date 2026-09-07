import { describe, it, expect, afterEach, vi } from "vitest";

import {
  isQrLoginEnabled,
  isStationSignupEnabled,
  isStationSignupAdminEnabled,
} from "@/lib/features/authentication/flags";

const ENV_KEY = "NEXT_PUBLIC_QR_LOGIN_ENABLED";
const STATION_SIGNUP_ENV_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ENABLED";
const STATION_SIGNUP_ADMIN_ENV_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED";

afterEach(() => vi.unstubAllEnvs());

describe("isQrLoginEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    vi.stubEnv(ENV_KEY, undefined);
    expect(isQrLoginEnabled()).toBe(false);
  });

  it.each(["true", "1"])("returns true when env var is %s", (value) => {
    vi.stubEnv(ENV_KEY, value);
    expect(isQrLoginEnabled()).toBe(true);
  });

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      vi.stubEnv(ENV_KEY, value);
      expect(isQrLoginEnabled()).toBe(false);
    }
  );
});

describe("isStationSignupEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    vi.stubEnv(STATION_SIGNUP_ENV_KEY, undefined);
    expect(isStationSignupEnabled()).toBe(false);
  });

  it.each(["true", "1"])("returns true when env var is %s", (value) => {
    vi.stubEnv(STATION_SIGNUP_ENV_KEY, value);
    expect(isStationSignupEnabled()).toBe(true);
  });

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      vi.stubEnv(STATION_SIGNUP_ENV_KEY, value);
      expect(isStationSignupEnabled()).toBe(false);
    }
  );
});

describe("isStationSignupAdminEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    vi.stubEnv(STATION_SIGNUP_ADMIN_ENV_KEY, undefined);
    expect(isStationSignupAdminEnabled()).toBe(false);
  });

  it.each(["true", "1"])("returns true when env var is %s", (value) => {
    vi.stubEnv(STATION_SIGNUP_ADMIN_ENV_KEY, value);
    expect(isStationSignupAdminEnabled()).toBe(true);
  });

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      vi.stubEnv(STATION_SIGNUP_ADMIN_ENV_KEY, value);
      expect(isStationSignupAdminEnabled()).toBe(false);
    }
  );
});
