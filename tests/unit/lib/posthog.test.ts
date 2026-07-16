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

describe("initTelemetry", () => {
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

    const { initTelemetry } = await import("@/lib/posthog");
    initTelemetry();

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

    const { initTelemetry } = await import("@/lib/posthog");
    initTelemetry();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test123",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
      })
    );
  });

  it("no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    const { initTelemetry } = await import("@/lib/posthog");
    initTelemetry();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("no-ops on server (when window is undefined)", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";

    const windowSpy = vi.spyOn(globalThis, "window", "get");
    windowSpy.mockReturnValue(undefined as any);

    const { initTelemetry } = await import("@/lib/posthog");
    initTelemetry();

    expect(posthog.init).not.toHaveBeenCalled();
    windowSpy.mockRestore();
  });

  it("skips re-init when posthog.__loaded is already true", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
    (posthog as any).__loaded = true;

    const { initTelemetry } = await import("@/lib/posthog");
    initTelemetry();

    expect(posthog.init).not.toHaveBeenCalled();
  });
});

describe("safe capture contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(posthog.capture).mockReset();
    vi.mocked(posthog.captureException).mockReset();
  });

  it("safeCapture forwards event and props to posthog.capture", async () => {
    const { safeCapture } = await import("@/lib/posthog");
    safeCapture("csp_violation", { blockedURI: "https://evil.example.com" });

    expect(posthog.capture).toHaveBeenCalledWith("csp_violation", {
      blockedURI: "https://evil.example.com",
    });
  });

  it("safeCapture never throws when the SDK throws", async () => {
    vi.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    const { safeCapture } = await import("@/lib/posthog");
    expect(() => safeCapture("some_event")).not.toThrow();
  });

  it("safeCaptureException forwards an Error unchanged", async () => {
    const err = new Error("boom");
    const { safeCaptureException } = await import("@/lib/posthog");
    safeCaptureException(err, { domain: "flowsheet" });

    expect(posthog.captureException).toHaveBeenCalledWith(err, {
      domain: "flowsheet",
    });
  });

  it("safeCaptureException wraps a non-Error value in an Error", async () => {
    const { safeCaptureException } = await import("@/lib/posthog");
    safeCaptureException("just a string");

    const captured = vi.mocked(posthog.captureException).mock.calls[0][0];
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("just a string");
  });

  it("safeCaptureException never throws when the SDK throws", async () => {
    vi.mocked(posthog.captureException).mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    const { safeCaptureException } = await import("@/lib/posthog");
    expect(() => safeCaptureException(new Error("boom"))).not.toThrow();
  });

  it("safeCapturePageview emits $pageview with $current_url", async () => {
    const { safeCapturePageview } = await import("@/lib/posthog");
    safeCapturePageview("https://wxyc.org/dashboard");

    expect(posthog.capture).toHaveBeenCalledWith("$pageview", {
      $current_url: "https://wxyc.org/dashboard",
    });
  });

  it("safeCapturePageview never throws when the SDK throws", async () => {
    vi.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    const { safeCapturePageview } = await import("@/lib/posthog");
    expect(() => safeCapturePageview("https://wxyc.org/live")).not.toThrow();
  });
});
