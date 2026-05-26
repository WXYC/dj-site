import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClearMailBinButton from "./ClearMailBinButton";

const mockRequestClear = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useClearMailBin: () => ({
    requestClear: mockRequestClear,
    clearing: false,
    disabled: false,
  }),
}));

describe("ClearMailBinButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a soft warning Clear button", () => {
    render(<ClearMailBinButton />);

    const button = screen.getByTestId("mail-bin-clear-button");
    expect(button).toHaveTextContent("Clear");
    expect(button).toHaveAttribute("aria-label", "Clear mail bin");
  });

  it("calls requestClear on click", async () => {
    const user = userEvent.setup();
    render(<ClearMailBinButton />);

    await user.click(screen.getByTestId("mail-bin-clear-button"));

    expect(mockRequestClear).toHaveBeenCalledTimes(1);
  });
});
