import { describe, it, expect, vi, beforeEach } from "vitest";

const { sentryCapture, sentryInit, posthogCapture } = vi.hoisted(() => ({
  sentryCapture: vi.fn(),
  sentryInit: vi.fn(),
  posthogCapture: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureExceptionInSentry: sentryCapture,
  initSentry: sentryInit,
}));
vi.mock("@/lib/posthog", () => ({
  captureExceptionInPostHog: posthogCapture,
}));

import { initErrorReporting, safeCaptureException } from "@/lib/error-reporting";

describe("safeCaptureException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The dual-sink contract: Sentry for grouping and release triage, PostHog
  // for the $exception stream crash investigation already reads. Losing
  // either sink silently is the regression this guards.
  it("reports to both sinks with the same Error instance and context", () => {
    const err = new Error("boom");
    safeCaptureException(err, { endpoint: "updateAlbum" });

    expect(sentryCapture).toHaveBeenCalledWith(err, { endpoint: "updateAlbum" });
    expect(posthogCapture).toHaveBeenCalledWith(err, { endpoint: "updateAlbum" });
    expect(sentryCapture.mock.calls[0][0]).toBe(posthogCapture.mock.calls[0][0]);
  });

  it("normalizes a non-Error value once, before either sink sees it", () => {
    safeCaptureException("just a string");

    const toSentry = sentryCapture.mock.calls[0][0];
    const toPostHog = posthogCapture.mock.calls[0][0];
    expect(toSentry).toBeInstanceOf(Error);
    expect(toSentry.message).toBe("just a string");
    expect(toSentry).toBe(toPostHog);
  });

  it("still reports to PostHog when the Sentry sink throws", () => {
    sentryCapture.mockImplementationOnce(() => {
      throw new Error("sentry adapter exploded");
    });

    expect(() => safeCaptureException(new Error("boom"))).not.toThrow();
    expect(posthogCapture).toHaveBeenCalledTimes(1);
  });

  it("still reports to Sentry when the PostHog sink throws", () => {
    posthogCapture.mockImplementationOnce(() => {
      throw new Error("posthog adapter exploded");
    });

    expect(() => safeCaptureException(new Error("boom"))).not.toThrow();
    expect(sentryCapture).toHaveBeenCalledTimes(1);
  });

  it("survives a value whose String() conversion throws", () => {
    const hostile = {
      toString() {
        throw new Error("nope");
      },
    };

    expect(() => safeCaptureException(hostile)).not.toThrow();
    expect(sentryCapture.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(posthogCapture).toHaveBeenCalledTimes(1);
  });
});

describe("initErrorReporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // PostHog starts through initTelemetry (it carries analytics too), so this
  // entry point owns only the Sentry sink.
  it("starts the Sentry sink", () => {
    initErrorReporting();

    expect(sentryInit).toHaveBeenCalledTimes(1);
  });
});
