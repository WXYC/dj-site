import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClassicLoginSlotSwitcher from "@/app/login/@classic/ClassicLoginSlotSwitcher";

const searchParamsMock = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

const normal = <div data-testid="normal-slot">normal</div>;
const reset = <div data-testid="reset-slot">reset</div>;
const signup = <div data-testid="signup-slot">signup</div>;

describe("ClassicLoginSlotSwitcher", () => {
  it("renders the normal slot when no token, error, or signup param is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("normal-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("reset-slot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signup-slot")).not.toBeInTheDocument();
  });

  it("renders the reset slot when a token param is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("token=abc123"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("reset-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("normal-slot")).not.toBeInTheDocument();
  });

  it("renders the reset slot when an error param is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("error=invalid-token"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("reset-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("normal-slot")).not.toBeInTheDocument();
  });

  it("renders the signup slot when ?signup=1 is present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("signup=1"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("signup-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("normal-slot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reset-slot")).not.toBeInTheDocument();
  });

  it("prefers the reset slot over signup when both a reset token and ?signup=1 are present", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("token=abc123&signup=1"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("reset-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("signup-slot")).not.toBeInTheDocument();
  });
});
