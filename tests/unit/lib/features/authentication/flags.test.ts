import { describe, it, expect, afterEach } from "vitest";

import { isQrLoginEnabled } from "@/lib/features/authentication/flags";

const ENV_KEY = "NEXT_PUBLIC_QR_LOGIN_ENABLED";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("isQrLoginEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    delete process.env[ENV_KEY];
    expect(isQrLoginEnabled()).toBe(false);
  });

  it.each(["true", "1"])("returns true when env var is %s", (value) => {
    process.env[ENV_KEY] = value;
    expect(isQrLoginEnabled()).toBe(true);
  });

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      process.env[ENV_KEY] = value;
      expect(isQrLoginEnabled()).toBe(false);
    }
  );
});
