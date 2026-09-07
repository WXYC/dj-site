import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

const searchParamsMock = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParamsMock(),
}));

import LoginFormSwitcher from "@/src/components/experiences/modern/login/Forms/LoginFormSwitcher";
import type { WelcomeQuote } from "@/src/components/experiences/modern/login/Quotes/Welcome";

const STATION_SIGNUP_FLAG_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ENABLED";
const TEST_WELCOME_QUOTE: WelcomeQuote = ["Welcome...", "to the Jungle", "Guns N' Roses"];

/**
 * Entry links from outside /login (the landing page's "Sign Up") arrive as
 * ?signup=1. Classic honors the param in ClassicLoginSlotSwitcher; modern has
 * to honor it here, because nothing else in the modern login tree reads the
 * URL — the stage otherwise comes from the preferred-login-method storage.
 */
describe("LoginFormSwitcher: ?signup=1 entry link", () => {
  beforeEach(() => {
    window.localStorage.clear();
    process.env[STATION_SIGNUP_FLAG_KEY] = "true";
  });

  afterEach(() => {
    delete process.env[STATION_SIGNUP_FLAG_KEY];
  });

  it("renders the station signup form when ?signup=1 is present and the flag is on", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("signup=1"));

    renderWithProviders(<LoginFormSwitcher welcomeQuote={TEST_WELCOME_QUOTE} />);

    expect(screen.getByText("Signup passcode")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send login code" })).toBeNull();
  });

  it("keeps ?signup=1 inert when the flag is off", () => {
    delete process.env[STATION_SIGNUP_FLAG_KEY];
    searchParamsMock.mockReturnValue(new URLSearchParams("signup=1"));

    renderWithProviders(<LoginFormSwitcher welcomeQuote={TEST_WELCOME_QUOTE} />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();
    expect(screen.queryByText("Signup passcode")).toBeNull();
  });

  it("renders the default form when the param is absent", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams(""));

    renderWithProviders(<LoginFormSwitcher welcomeQuote={TEST_WELCOME_QUOTE} />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();
    expect(screen.queryByText("Signup passcode")).toBeNull();
  });
});
