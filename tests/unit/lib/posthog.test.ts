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

// posthog-js is now loaded via a deferred dynamic import (#972), so
// initTelemetry resolves the client on a microtask. Flush the queue before
// asserting on init/capture, and re-import the module per test (vi.resetModules)
// so the module-level `client`/`loading` singletons reset.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function loadTelemetry() {
  const mod = await import("@/lib/posthog");
  return mod;
}

async function initAndWait() {
  const mod = await loadTelemetry();
  mod.initTelemetry();
  await flush();
  return mod;
}

describe("initTelemetry", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(posthog.init).mockClear();
    (posthog as any).__loaded = false;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("calls posthog.init with correct config when NEXT_PUBLIC_POSTHOG_KEY is set", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://custom.posthog.com";

    await initAndWait();

    expect(posthog.init).toHaveBeenCalledWith("phc_test123", {
      api_host: "https://custom.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      capture_exceptions: true,
    });
  });

  it("defaults posthog host to https://us.i.posthog.com", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;

    await initAndWait();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test123",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
      })
    );
  });

  it("no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    await initAndWait();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("no-ops on server (when window is undefined)", async () => {
    const windowSpy = vi.spyOn(globalThis, "window", "get");
    windowSpy.mockReturnValue(undefined as any);

    await initAndWait();

    expect(posthog.init).not.toHaveBeenCalled();
    windowSpy.mockRestore();
  });

  it("skips re-init when posthog.__loaded is already true", async () => {
    (posthog as any).__loaded = true;

    await initAndWait();

    expect(posthog.init).not.toHaveBeenCalled();
  });
});

describe("safe capture contract", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(posthog.capture).mockReset();
    vi.mocked(posthog.captureException).mockReset();
    (posthog as any).__loaded = false;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("no-ops safely before the dynamic import resolves", async () => {
    const { safeCapture, safeCaptureException } = await loadTelemetry();

    expect(() => safeCapture("early_event")).not.toThrow();
    expect(() => safeCaptureException(new Error("early"))).not.toThrow();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.captureException).not.toHaveBeenCalled();
  });

  it("safeCapture forwards event and props to posthog.capture once loaded", async () => {
    const { safeCapture } = await initAndWait();
    safeCapture("csp_violation", { blockedURI: "https://evil.example.com" });

    expect(posthog.capture).toHaveBeenCalledWith("csp_violation", {
      blockedURI: "https://evil.example.com",
    });
  });

  it("safeCapture never throws when the SDK throws", async () => {
    const { safeCapture } = await initAndWait();
    vi.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    expect(() => safeCapture("some_event")).not.toThrow();
  });

  it("safeCaptureException forwards an Error unchanged once loaded", async () => {
    const err = new Error("boom");
    const { safeCaptureException } = await initAndWait();
    safeCaptureException(err, { domain: "flowsheet" });

    expect(posthog.captureException).toHaveBeenCalledWith(err, {
      domain: "flowsheet",
    });
  });

  it("safeCaptureException wraps a non-Error value in an Error", async () => {
    const { safeCaptureException } = await initAndWait();
    safeCaptureException("just a string");

    const captured = vi.mocked(posthog.captureException).mock.calls[0][0];
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("just a string");
  });

  it("safeCaptureException never throws when the SDK throws", async () => {
    const { safeCaptureException } = await initAndWait();
    vi.mocked(posthog.captureException).mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    expect(() => safeCaptureException(new Error("boom"))).not.toThrow();
  });

  it("safeCapturePageview emits $pageview with $current_url", async () => {
    const { safeCapturePageview } = await initAndWait();
    safeCapturePageview("https://wxyc.org/dashboard");

    expect(posthog.capture).toHaveBeenCalledWith("$pageview", {
      $current_url: "https://wxyc.org/dashboard",
    });
  });

  it("safeCapturePageview never throws when the SDK throws", async () => {
    const { safeCapturePageview } = await initAndWait();
    vi.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    expect(() => safeCapturePageview("https://wxyc.org/live")).not.toThrow();
  });
});
