import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import UserPasswordForm from "./UserPasswordForm";
import { renderWithProviders } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(""),
}));

const QR_FLAG_KEY = "NEXT_PUBLIC_QR_LOGIN_ENABLED";

describe("UserPasswordForm", () => {
  it("should render identifier and password fields", () => {
    renderWithProviders(<UserPasswordForm />);

    expect(screen.getByText("Username or email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithProviders(<UserPasswordForm />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should render forgot password link", () => {
    renderWithProviders(<UserPasswordForm />);

    expect(screen.getByRole("button", { name: "Forgot?" })).toBeInTheDocument();
  });

  it("should have submit button disabled initially", () => {
    renderWithProviders(<UserPasswordForm />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should enable submit button when both fields have values", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);

    const usernameInput = screen.getByPlaceholderText("Username or email");
    const passwordInput = screen.getByPlaceholderText("Enter your password");

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpass");

    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("should keep submit button disabled with only username", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);

    const usernameInput = screen.getByPlaceholderText("Username or email");
    await user.type(usernameInput, "testuser");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should have forgot link enabled by default", () => {
    renderWithProviders(<UserPasswordForm />);

    // The forgot link is always enabled - users will be prompted for email on the forgot page
    const forgotLink = screen.getByRole("button", { name: "Forgot?" });
    expect(forgotLink).not.toHaveClass("Mui-disabled");
  });

  it("should render as a form with post method", () => {
    const { container } = renderWithProviders(<UserPasswordForm />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "post");
  });

  describe("QR entry link (flag-gated)", () => {
    afterEach(() => {
      delete process.env[QR_FLAG_KEY];
    });

    it("is hidden when the QR flag is off", () => {
      delete process.env[QR_FLAG_KEY];
      renderWithProviders(<UserPasswordForm />);

      expect(
        screen.queryByRole("button", { name: "Sign in with a QR code" })
      ).not.toBeInTheDocument();
    });

    it("switches to the qr stage when the flag is on", async () => {
      process.env[QR_FLAG_KEY] = "true";
      const { user, store } = renderWithProviders(<UserPasswordForm />);

      await user.click(
        screen.getByRole("button", { name: "Sign in with a QR code" })
      );

      expect(applicationSlice.selectors.getAuthStage(store.getState())).toBe(
        "qr"
      );
    });
  });
});
