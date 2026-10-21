import { describe, it, expect, vi, beforeEach } from "vitest";

const { posthogCapture } = vi.hoisted(() => ({
  posthogCapture: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  captureExceptionInPostHog: posthogCapture,
}));

import { safeCaptureException } from "@/lib/error-reporting";

describe("safeCaptureException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports the Error instance and context to PostHog", () => {
    const err = new Error("boom");
    safeCaptureException(err, { endpoint: "updateAlbum" });

    expect(posthogCapture).toHaveBeenCalledWith(err, { endpoint: "updateAlbum" }, undefined);
  });

  it("forwards the static label to PostHog, after the context", () => {
    const err = new Error("boom");
    safeCaptureException(err, { endpoint: "updateAlbum" }, "album-update");

    expect(posthogCapture).toHaveBeenCalledWith(err, { endpoint: "updateAlbum" }, "album-update");
  });

  it("normalizes a non-Error value before the sink sees it", () => {
    safeCaptureException("just a string");

    const toPostHog = posthogCapture.mock.calls[0][0];
    expect(toPostHog).toBeInstanceOf(Error);
    expect(toPostHog.message).toBe("just a string");
  });

  it("does not throw when the PostHog sink throws", () => {
    posthogCapture.mockImplementationOnce(() => {
      throw new Error("posthog adapter exploded");
    });

    expect(() => safeCaptureException(new Error("boom"))).not.toThrow();
  });

  it("survives a value whose String() conversion throws", () => {
    const hostile = {
      toString() {
        throw new Error("nope");
      },
    };

    expect(() => safeCaptureException(hostile)).not.toThrow();
    expect(posthogCapture.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
