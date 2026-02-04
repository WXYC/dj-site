import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import ResetPasswordForm from "./ResetPasswordForm";
import { renderWithProviders } from "@/lib/test-utils";
import type { PasswordResetUser } from "@/lib/features/authentication/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("ResetPasswordForm", () => {
  const defaultProps: PasswordResetUser = {
    confirmationMessage: "Reset your password",
    token: "test-token-123",
  };

  it("should render new password field", () => {
    renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    expect(screen.getByText("New Password")).toBeInTheDocument();
  });

  it("should render confirm password field", () => {
    renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    expect(screen.getByText("Confirm New Password")).toBeInTheDocument();
  });

  it("should render password requirements helper text", () => {
    renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    expect(
      screen.getByText(/Must be at least 8 characters/)
    ).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should have hidden token input", () => {
    const { container } = renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    const hiddenInput = container.querySelector('input[name="token"]');
    expect(hiddenInput).toHaveAttribute("type", "hidden");
    expect(hiddenInput).toHaveValue("test-token-123");
  });

  it("should have submit button disabled initially", () => {
    renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should enable submit when all fields are valid", async () => {
    const { user } = renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    await user.type(passwordInput, "Password1");
    await user.type(confirmInput, "Password1");

    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("should keep submit disabled when password invalid", async () => {
    const { user } = renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    await user.type(passwordInput, "weak");
    await user.type(confirmInput, "weak");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should keep submit disabled when passwords do not match", async () => {
    const { user } = renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    await user.type(passwordInput, "Password1");
    await user.type(confirmInput, "Password2");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should keep submit disabled when token is missing", async () => {
    const propsWithoutToken: PasswordResetUser = {
      confirmationMessage: "Reset your password",
    };
    const { user } = renderWithProviders(<ResetPasswordForm {...propsWithoutToken} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    await user.type(passwordInput, "Password1");
    await user.type(confirmInput, "Password1");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should render as a form with post method", () => {
    const { container } = renderWithProviders(<ResetPasswordForm {...defaultProps} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "post");
  });
});
