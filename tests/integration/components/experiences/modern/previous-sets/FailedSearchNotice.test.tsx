import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import FailedSearchNotice from "@/src/components/experiences/modern/previous-sets/FailedSearchNotice";

describe("FailedSearchNotice", () => {
  it("announces the failure and offers a retry control outside the announcement", () => {
    render(<FailedSearchNotice onRetry={vi.fn()} />);

    const announcement = screen.getByRole("alert");
    expect(announcement).toHaveTextContent(/^An error occurred while searching\.$/);
    const control = screen.getByRole("button", { name: "Try again" });
    expect(announcement).not.toContainElement(control);
  });

  // A notice that stayed up through a retry announces the next failure only
  // if its live region is inserted again.
  it("re-inserts the announcement when a retry fails again", () => {
    const { rerender } = render(<FailedSearchNotice onRetry={vi.fn()} />);
    const first = screen.getByRole("alert");

    rerender(<FailedSearchNotice onRetry={vi.fn()} failedRetries={1} />);

    expect(screen.getByRole("alert")).not.toBe(first);
  });

  it("calls onRetry once when the control is used", async () => {
    const onRetry = vi.fn();
    const { user } = render(<FailedSearchNotice onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // Focus must survive the switch to retrying: the control the reader just
  // used is still where the keyboard is when the retry fails or succeeds.
  it("keeps the control focused and inert while retrying", async () => {
    const onRetry = vi.fn();
    const { user, rerender } = render(<FailedSearchNotice onRetry={onRetry} />);
    const control = screen.getByRole("button", { name: "Try again" });
    control.focus();

    rerender(<FailedSearchNotice onRetry={onRetry} retrying />);

    expect(control).toHaveTextContent("Retrying…");
    expect(control).toHaveAttribute("aria-disabled", "true");
    // jsdom does not move focus off a disabled element, so pin the mechanism.
    expect(control).not.toHaveAttribute("disabled");
    expect(control).toHaveFocus();
    await user.click(control);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each([
    { align: "center" as const, justify: "center" },
    { align: "start" as const, justify: "flex-start" },
  ])("aligns to the $align", ({ align, justify }) => {
    render(<FailedSearchNotice onRetry={vi.fn()} align={align} />);

    const notice = screen.getByRole("alert").parentElement;
    if (notice === null) throw new Error("no notice");
    expect(getComputedStyle(notice).justifyContent).toBe(justify);
  });
});
