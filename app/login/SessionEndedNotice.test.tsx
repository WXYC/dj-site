import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/lib/test-utils";

// Mock the query string the server redirect lands on.
const searchParamsMock = vi.fn<() => URLSearchParams>();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

// Mock sonner so we can assert the friendly notice without a live Toaster.
const mockToastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    info: (...args: any[]) => mockToastInfo(...args),
  },
}));

import SessionEndedNotice from "./SessionEndedNotice";

describe("SessionEndedNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
  });

  it("shows a neutral session-ended notice when requireAuth bounced with no-session", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));

    renderWithProviders(<SessionEndedNotice />);

    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Your session has ended. Please sign in again.",
      expect.objectContaining({ id: "session-ended" }),
    );
  });

  it("stays silent on a normal login view (no bounce param)", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("verified=true"));

    renderWithProviders(<SessionEndedNotice />);

    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it("does not fire for email-not-verified or incomplete, which have their own inline UI", () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams("incomplete=true&bounced=incomplete"),
    );
    const { rerender } = renderWithProviders(<SessionEndedNotice />);

    searchParamsMock.mockReturnValue(
      new URLSearchParams("error=email-not-verified&bounced=email-not-verified"),
    );
    rerender(<SessionEndedNotice />);

    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it("shows the notice at most once for a single bounce", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));

    const { rerender } = renderWithProviders(<SessionEndedNotice />);
    rerender(<SessionEndedNotice />);

    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it("does not re-toast when the param clears and returns to no-session within one mount", () => {
    // This forces the effect to actually re-run (reason changes each render), so
    // the pass genuinely depends on the `shown` ref guard — not merely on the
    // [reason] dependency being unchanged. Deleting the guard would toast twice.
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));
    const { rerender } = renderWithProviders(<SessionEndedNotice />);

    searchParamsMock.mockReturnValue(new URLSearchParams(""));
    rerender(<SessionEndedNotice />);

    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));
    rerender(<SessionEndedNotice />);

    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("bounced=no-session"));

    const { container } = renderWithProviders(<SessionEndedNotice />);

    expect(container.firstChild).toBeNull();
  });
});
