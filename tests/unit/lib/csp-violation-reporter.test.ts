import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeCapture } from "@/lib/posthog";
import {
  handleSecurityPolicyViolation,
  resetCspViolationReporterForTests,
} from "@/lib/csp-violation-reporter";

vi.mock("@/lib/posthog", () => ({
  safeCapture: vi.fn(),
}));

function violation(overrides: Partial<{
  violatedDirective: string;
  blockedURI: string;
  documentURI: string;
  disposition: string;
}> = {}) {
  return {
    violatedDirective: "connect-src",
    blockedURI: "https://evil.example.com/collect?token=secret123",
    documentURI: "https://dj.wxyc.org/dashboard/flowsheet?session=abc",
    disposition: "report",
    ...overrides,
  } as SecurityPolicyViolationEvent;
}

describe("handleSecurityPolicyViolation", () => {
  beforeEach(() => {
    vi.mocked(safeCapture).mockClear();
    resetCspViolationReporterForTests();
  });

  it("captures a csp_violation event with trimmed payload", () => {
    handleSecurityPolicyViolation(violation());

    expect(safeCapture).toHaveBeenCalledTimes(1);
    expect(safeCapture).toHaveBeenCalledWith("csp_violation", {
      violatedDirective: "connect-src",
      // Origin only — the full URL's path/query (potential tokens) must not
      // ship to telemetry.
      blockedURI: "https://evil.example.com",
      // Path only — no query string.
      documentURI: "/dashboard/flowsheet",
      disposition: "report",
    });
  });

  it("passes non-URL blockedURI keywords through unchanged", () => {
    handleSecurityPolicyViolation(
      violation({ violatedDirective: "script-src", blockedURI: "inline" })
    );

    expect(safeCapture).toHaveBeenCalledWith(
      "csp_violation",
      expect.objectContaining({ blockedURI: "inline" })
    );
  });

  it("dedupes repeat violations of the same (directive, origin) pair", () => {
    handleSecurityPolicyViolation(violation());
    handleSecurityPolicyViolation(
      violation({ blockedURI: "https://evil.example.com/other-path" })
    );

    expect(safeCapture).toHaveBeenCalledTimes(1);
  });

  it("still reports the same origin under a different directive", () => {
    handleSecurityPolicyViolation(violation());
    handleSecurityPolicyViolation(violation({ violatedDirective: "img-src" }));

    expect(safeCapture).toHaveBeenCalledTimes(2);
  });

  it("caps reports per session so distinct origins cannot flood telemetry", () => {
    for (let i = 0; i < 60; i++) {
      handleSecurityPolicyViolation(
        violation({ blockedURI: `https://origin-${i}.example.com/x` })
      );
    }

    expect(safeCapture).toHaveBeenCalledTimes(50);
  });
});
