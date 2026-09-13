import { describe, it, expect } from "vitest";
import { backendWriteErrorMessage } from "@/lib/backend-error-message";

const FALLBACK = "Could not add to flowsheet";

describe("backendWriteErrorMessage", () => {
  it("prefers the reason Backend-Service sent", () => {
    expect(
      backendWriteErrorMessage({ status: 400, data: { message: "Show not live" } }, FALLBACK)
    ).toBe("Show not live");
  });

  it("falls back to an Error's message", () => {
    expect(backendWriteErrorMessage(new Error("Network request failed"), FALLBACK)).toBe(
      "Network request failed"
    );
  });

  // The shared write path rejects with a bare string when no DJ is signed in.
  it("passes a rejected string through", () => {
    expect(backendWriteErrorMessage("User not logged in", FALLBACK)).toBe(
      "User not logged in"
    );
  });

  it.each([
    { label: "undefined", err: undefined },
    { label: "null", err: null },
    { label: "an empty object", err: {} },
    { label: "a payload with no message", err: { data: {} } },
    { label: "a non-string message", err: { data: { message: 42 } } },
  ])("falls back to the caller's own copy for $label", ({ err }) => {
    expect(backendWriteErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });

  // Interpolating the raw error is what produced "[object Object]".
  it("never renders an object placeholder", () => {
    expect(backendWriteErrorMessage({ status: 500 }, FALLBACK)).not.toContain("[object");
  });
});
