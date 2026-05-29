import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";

vi.mock("posthog-js", () => {
  return {
    default: {
      init: vi.fn(),
      capture: vi.fn(),
      captureException: vi.fn(),
      __loaded: false,
    },
  };
});

describe("initPostHog", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(posthog.init).mockClear();
    (posthog as any).__loaded = false;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("calls posthog.init with correct config when NEXT_PUBLIC_POSTHOG_KEY is set", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://custom.posthog.com";

    const { initPostHog } = await import("@/lib/posthog");
    initPostHog();

    expect(posthog.init).toHaveBeenCalledWith("phc_test123", {
      api_host: "https://custom.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      capture_exceptions: true,
    });
  });

  it("defaults posthog host to https://us.i.posthog.com", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;

    const { initPostHog } = await import("@/lib/posthog");
    initPostHog();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test123",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
      })
    );
  });

  it("no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    const { initPostHog } = await import("@/lib/posthog");
    initPostHog();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("no-ops on server (when window is undefined)", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";

    const windowSpy = vi.spyOn(globalThis, "window", "get");
    windowSpy.mockReturnValue(undefined as any);

    const { initPostHog } = await import("@/lib/posthog");
    initPostHog();

    expect(posthog.init).not.toHaveBeenCalled();
    windowSpy.mockRestore();
  });

  it("skips re-init when posthog.__loaded is already true", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
    (posthog as any).__loaded = true;

    const { initPostHog } = await import("@/lib/posthog");
    initPostHog();

    expect(posthog.init).not.toHaveBeenCalled();
  });
});
