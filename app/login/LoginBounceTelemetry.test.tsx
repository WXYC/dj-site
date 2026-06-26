import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/lib/test-utils";

// Mock the query string the server redirect lands on.
const searchParamsMock = vi.fn<() => URLSearchParams>();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

// Mock PostHog telemetry so we can inspect the emitted server-bounce event
// without initialising PostHog (safeCapture already swallows in SSR/tests).
const mockSafeCapture = vi.fn();
vi.mock("@/lib/posthog", () => ({
  safeCapture: (...args: any[]) => mockSafeCapture(...args),
}));

import LoginBounceTelemetry from "./LoginBounceTelemetry";

describe("LoginBounceTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
  });

  it("emits login_server_bounce with the no-session reason (the station-Mac bug)", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));

    renderWithProviders(<LoginBounceTelemetry />);

    expect(mockSafeCapture).toHaveBeenCalledWith("login_server_bounce", {
      reason: "no-session",
    });
  });

  it("emits the email-not-verified reason alongside the UI error param", () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams("error=email-not-verified&bounced=email-not-verified"),
    );

    renderWithProviders(<LoginBounceTelemetry />);

    expect(mockSafeCapture).toHaveBeenCalledWith("login_server_bounce", {
      reason: "email-not-verified",
    });
  });

  it("emits the incomplete reason", () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams("incomplete=true&bounced=incomplete"),
    );

    renderWithProviders(<LoginBounceTelemetry />);

    expect(mockSafeCapture).toHaveBeenCalledWith("login_server_bounce", {
      reason: "incomplete",
    });
  });

  it("stays silent on a normal login view (no bounce param)", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("verified=true"));

    renderWithProviders(<LoginBounceTelemetry />);

    expect(mockSafeCapture).not.toHaveBeenCalled();
  });

  it("emits at most once for a single bounce", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));

    const { rerender } = renderWithProviders(<LoginBounceTelemetry />);
    rerender(<LoginBounceTelemetry />);

    expect(mockSafeCapture).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));

    const { container } = renderWithProviders(<LoginBounceTelemetry />);

    expect(container.firstChild).toBeNull();
  });
});
