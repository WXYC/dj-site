import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClassicLoginSlotSwitcher from "@/app/login/@classic/ClassicLoginSlotSwitcher";

const searchParamsMock = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

const STATION_SIGNUP_FLAG_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ENABLED";

const normal = <div data-testid="normal-slot">normal</div>;
const reset = <div data-testid="reset-slot">reset</div>;
const signup = <div data-testid="signup-slot">signup</div>;

describe("ClassicLoginSlotSwitcher", () => {
  beforeEach(() => {
    process.env[STATION_SIGNUP_FLAG_KEY] = "true";
  });

  afterEach(() => {
    delete process.env[STATION_SIGNUP_FLAG_KEY];
  });

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

  it("renders the normal slot for ?signup=1 when the station signup flag is off", () => {
    // The flag has to gate the URL, not just the entry link on the login form:
    // otherwise a deploy with signup deliberately off still serves the whole
    // form to anyone who types ?signup=1, and against a backend whose own
    // STATION_SIGNUP_ENABLED is on that provisions real accounts.
    delete process.env[STATION_SIGNUP_FLAG_KEY];
    searchParamsMock.mockReturnValue(new URLSearchParams("signup=1"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("normal-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("signup-slot")).not.toBeInTheDocument();
  });

  it("still routes a reset link to the reset slot when the station signup flag is off", () => {
    delete process.env[STATION_SIGNUP_FLAG_KEY];
    searchParamsMock.mockReturnValue(new URLSearchParams("token=abc123&signup=1"));
    render(<ClassicLoginSlotSwitcher normal={normal} reset={reset} signup={signup} />);
    expect(screen.getByTestId("reset-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("signup-slot")).not.toBeInTheDocument();
  });
});
