import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

const mockSafeCapture = vi.fn();
vi.mock("@/lib/posthog", () => ({
  safeCapture: (...args: unknown[]) => mockSafeCapture(...args),
}));

import SessionUnavailable from "@/app/dashboard/SessionUnavailable";

describe("SessionUnavailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits session_unavailable exactly once across a double-mount, with the classified status", () => {
    const { rerender } = renderWithProviders(<SessionUnavailable status={429} />);
    rerender(<SessionUnavailable status={429} />);

    expect(mockSafeCapture).toHaveBeenCalledTimes(1);
    expect(mockSafeCapture).toHaveBeenCalledWith("session_unavailable", { status: 429 });
  });

  it("still emits once, with no status, for a transport failure (status unknown)", () => {
    renderWithProviders(<SessionUnavailable />);

    expect(mockSafeCapture).toHaveBeenCalledTimes(1);
    expect(mockSafeCapture).toHaveBeenCalledWith("session_unavailable", { status: undefined });
  });

  it("calls router.refresh() when the retry button is clicked", async () => {
    const { user } = renderWithProviders(<SessionUnavailable status={503} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("links Sign in again to /login as an escape hatch from a misclassified failure", () => {
    renderWithProviders(<SessionUnavailable status={429} />);

    const link = screen.getByRole("link", { name: /sign in again/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("tells the DJ their session has not ended, distinct from the SessionEndedNotice copy", () => {
    renderWithProviders(<SessionUnavailable status={429} />);

    expect(
      screen.getByText(/session hasn.t ended/i)
    ).toBeInTheDocument();
  });
});
