import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import NewUserForm from "./NewUserForm";
import { renderWithProviders } from "@/lib/test-utils";
import type { IncompleteUser } from "@/lib/features/authentication/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("NewUserForm", () => {
  const defaultProps: IncompleteUser = {
    username: "testuser",
    requiredAttributes: [],
  };

  it("should render submit button", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should render password field", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByText("New Password")).toBeInTheDocument();
  });

  it("should render confirm password field", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByText("Confirm New Password")).toBeInTheDocument();
  });

  it("should render password requirements helper text", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(
      screen.getByText(/Must be at least 8 characters/)
    ).toBeInTheDocument();
  });

  it("should render required attributes as fields", () => {
    renderWithProviders(
      <NewUserForm username="testuser" requiredAttributes={["realName", "djName"]} />
    );

    expect(screen.getByText("Real Name")).toBeInTheDocument();
    expect(screen.getByText("DJ Name")).toBeInTheDocument();
  });

  it("should have hidden username input", () => {
    const { container } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const hiddenInput = container.querySelector('input[name="username"]');
    expect(hiddenInput).toHaveAttribute("type", "hidden");
    expect(hiddenInput).toHaveValue("testuser");
  });

  it("should have submit button disabled initially", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should enable submit when valid password and confirmation match", async () => {
    const { user } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    // Type valid password (8+ chars, uppercase, number)
    await user.type(passwordInput, "Password1");
    await user.type(confirmInput, "Password1");

    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("should keep submit disabled when password too short", async () => {
    const { user } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    await user.type(passwordInput, "Pass1");
    await user.type(confirmInput, "Pass1");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should keep submit disabled when passwords do not match", async () => {
    const { user } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("Enter your new password");
    const confirmInput = screen.getByPlaceholderText("Confirm New Password");

    await user.type(passwordInput, "Password1");
    await user.type(confirmInput, "Password2");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should render as a form with put method", () => {
    const { container } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "put");
  });
});
