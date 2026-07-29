import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { measure } from "@/lib/server-timing";

describe("measure", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("returns the wrapped result (enabled)", async () => {
    vi.stubEnv("SERVER_TIMING", "1");
    await expect(measure("auth.getSession", async () => 42)).resolves.toBe(42);
  });

  it("returns the wrapped result (disabled — passthrough)", async () => {
    vi.stubEnv("SERVER_TIMING", "0");
    await expect(measure("auth.getSession", async () => "ok")).resolves.toBe("ok");
  });

  it("does not log when the flag is off", async () => {
    vi.stubEnv("SERVER_TIMING", "0");
    await measure("auth.getSession", async () => 1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs one [server_timing] line with phase, numeric dur, and meta when enabled", async () => {
    vi.stubEnv("SERVER_TIMING", "1");
    await measure("auth.orgRole", async () => 1, { org: "app" });

    expect(warn).toHaveBeenCalledTimes(1);
    const [tag, payload] = warn.mock.calls[0] as [string, Record<string, unknown>];
    expect(tag).toBe("[server_timing]");
    expect(payload).toMatchObject({ phase: "auth.orgRole", org: "app" });
    expect(typeof payload.dur).toBe("number");
  });

  it("still logs and rethrows on failure", async () => {
    vi.stubEnv("SERVER_TIMING", "1");
    await expect(
      measure("auth.getSession", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
