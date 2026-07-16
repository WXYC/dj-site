import { describe, it, expect, afterEach, vi } from "vitest";
import { getOrchestratorUrl, isAutoDJStatusEnabled } from "@/lib/features/autoDJ/flags";

afterEach(() => vi.unstubAllEnvs());

describe("auto-dj flags", () => {
  it("is disabled when NEXT_PUBLIC_ORCHESTRATOR_URL is unset or empty", () => {
    vi.stubEnv("NEXT_PUBLIC_ORCHESTRATOR_URL", "");
    expect(getOrchestratorUrl()).toBeUndefined();
    expect(isAutoDJStatusEnabled()).toBe(false);
  });

  it("is enabled and returns the URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_ORCHESTRATOR_URL", "http://localhost:8090");
    expect(getOrchestratorUrl()).toBe("http://localhost:8090");
    expect(isAutoDJStatusEnabled()).toBe(true);
  });
});
