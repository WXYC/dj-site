import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import LoginFormSwitcher from "@/src/components/experiences/modern/login/Forms/LoginFormSwitcher";

/**
 * The existing EmailOTPForm test asserts the "Sign in with password instead"
 * link RENDERS. Nothing asserts that clicking it does anything. This drives the
 * switch through the component that owns the decision.
 */
describe("LoginFormSwitcher: password fallback", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("swaps the OTP form for the password form when the fallback is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LoginFormSwitcher welcomeQuote={["Welcome...", "to the Jungle", "Guns N' Roses"]} />
    );

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign in with password instead" }));

    expect(screen.getByPlaceholderText("Username or email")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send login code" })).toBeNull();
  });
});
