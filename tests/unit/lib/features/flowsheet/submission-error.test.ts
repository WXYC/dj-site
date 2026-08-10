import { describe, it, expect } from "vitest";
import { flowsheetWriteErrorMessage } from "@/lib/features/flowsheet/submission-error";

describe("flowsheetWriteErrorMessage", () => {
  it("prefers the reason Backend-Service sent", () => {
    expect(
      flowsheetWriteErrorMessage({ status: 400, data: { message: "Show not live" } })
    ).toBe("Show not live");
  });

  it("falls back to an Error's message", () => {
    expect(flowsheetWriteErrorMessage(new Error("Network request failed"))).toBe(
      "Network request failed"
    );
  });

  // The shared write path rejects with a bare string when no DJ is signed in.
  it("passes a rejected string through", () => {
    expect(flowsheetWriteErrorMessage("User not logged in")).toBe(
      "User not logged in"
    );
  });

  it.each([
    { label: "undefined", err: undefined },
    { label: "null", err: null },
    { label: "an empty object", err: {} },
    { label: "a payload with no message", err: { data: {} } },
    { label: "a non-string message", err: { data: { message: 42 } } },
  ])("falls back to generic copy for $label", ({ err }) => {
    expect(flowsheetWriteErrorMessage(err)).toBe("Could not add to flowsheet");
  });

  // Interpolating the raw error is what produced "[object Object]".
  it("never renders an object placeholder", () => {
    expect(flowsheetWriteErrorMessage({ status: 500 })).not.toContain("[object");
  });
});
