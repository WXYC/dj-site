import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClassicLoginSlotSwitcher from "./ClassicLoginSlotSwitcher";

const searchParamsMock = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

const normal = <div data-testid="normal-slot">normal</div>;
const reset = <div data-testid="reset-slot">reset</div>;

describe("ClassicLoginSlotSwitcher", () => {
  it("renders the normal slot when no token or error param is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} />);
    expect(screen.getByTestId("normal-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("reset-slot")).not.toBeInTheDocument();
  });

  it("renders the reset slot when a token param is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("token=abc123"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} />);
    expect(screen.getByTestId("reset-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("normal-slot")).not.toBeInTheDocument();
  });

  it("renders the reset slot when an error param is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("error=invalid-token"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} />);
    expect(screen.getByTestId("reset-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("normal-slot")).not.toBeInTheDocument();
  });
});
