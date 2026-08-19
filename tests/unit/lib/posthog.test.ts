import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// posthog-js is now loaded via a deferred dynamic import. Hoisted so the
// mock SDK is available for assertions; the rejection test overrides this with
// vi.doMock to make the dynamic import fail.
const control = vi.hoisted(() => ({
  posthog: {
    init: vi.fn(),
    capture: vi.fn(),
    __loaded: false,
  },
}));

vi.mock("posthog-js", () => ({ default: control.posthog }));

const posthog = control.posthog;

// initTelemetry resolves the client on a microtask, so flush the queue before
// asserting. Re-import per test (vi.resetModules) so the module-level
// client/loading/buffer singletons reset.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function loadTelemetry() {
  return import("@/lib/posthog");
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
    posthog.init.mockClear();
    posthog.capture.mockClear();
    posthog.__loaded = false;
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
      // Anonymization posture: analytics only, never identity or error
      // payloads — errors are Sentry's (lib/sentry.ts), and autocapture /
      // recording would serialize on-screen PII (roster page DJ names/emails).
      capture_exceptions: false,
      person_profiles: "identified_only",
      autocapture: false,
      disable_session_recording: true,
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
    posthog.__loaded = true;

    await initAndWait();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("imports posthog-js exactly once when initTelemetry is called twice (remount)", async () => {
    const mod = await loadTelemetry();
    mod.initTelemetry();
    mod.initTelemetry();
    await flush();

    expect(posthog.init).toHaveBeenCalledTimes(1);
  });
});

describe("safe capture contract", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    posthog.capture.mockReset();
    posthog.init.mockReset();
    posthog.__loaded = false;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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
    posthog.capture.mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    expect(() => safeCapture("some_event")).not.toThrow();
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
    posthog.capture.mockImplementationOnce(() => {
      throw new Error("posthog not initialized");
    });

    expect(() => safeCapturePageview("https://wxyc.org/live")).not.toThrow();
  });
});

describe("pre-load buffer", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    posthog.capture.mockReset();
    posthog.init.mockReset();
    posthog.__loaded = false;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("flushes captures fired before load in order once the client resolves", async () => {
    const mod = await loadTelemetry();
    mod.initTelemetry(); // load is in-flight, client still null

    mod.safeCapturePageview("https://wxyc.org/live");
    mod.safeCapture("web_vitals", { name: "TTFB", value: 12 });

    // Nothing forwarded while the chunk is still loading.
    expect(posthog.capture).not.toHaveBeenCalled();

    await flush();

    expect(posthog.capture).toHaveBeenNthCalledWith(1, "$pageview", {
      $current_url: "https://wxyc.org/live",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, "web_vitals", {
      name: "TTFB",
      value: 12,
    });
  });

  it("no-ops (no buffering, no flush) when telemetry was never initialized", async () => {
    const { safeCapture } = await loadTelemetry();
    safeCapture("orphan_event");
    await flush();

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("all wrappers no-op and buffer clears when the dynamic import rejects", async () => {
    // Force the posthog-js chunk import to fail for this test only.
    vi.doMock("posthog-js", () => {
      throw new Error("chunk load failed");
    });
    try {
      const mod = await import("@/lib/posthog");
      mod.initTelemetry();

      // Buffer some events during the (doomed) load window.
      mod.safeCapture("early_event");
      mod.safeCapturePageview("https://wxyc.org/live");

      // Let the rejected import settle; must not raise an unhandled rejection.
      await flush();

      expect(posthog.capture).not.toHaveBeenCalled();

      // Post-failure captures also no-op (session stays dark, buffer cleared).
      mod.safeCapture("later_event");
      await flush();
      expect(posthog.capture).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("posthog-js");
      vi.resetModules();
    }
  });
});
