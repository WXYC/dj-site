import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import UserPasswordForm from "./UserPasswordForm";
import { renderWithProviders } from "@/lib/test-utils";
import { applicationSlice } from "@/lib/features/application/frontend";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("UserPasswordForm", () => {
  it("should render username and password fields", () => {
    renderWithProviders(<UserPasswordForm />);

    expect(screen.getByText("Username")).toBeInTheDocument();
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

    const usernameInput = screen.getByPlaceholderText("Username");
    const passwordInput = screen.getByPlaceholderText("Enter your password");

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpass");

    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("should keep submit button disabled with only username", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);

    const usernameInput = screen.getByPlaceholderText("Username");
    await user.type(usernameInput, "testuser");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should have forgot link enabled by default", () => {
    renderWithProviders(<UserPasswordForm />);

    // Forgot link is always enabled except during authentication
    expect(screen.getByRole("button", { name: "Forgot?" })).not.toHaveClass("Mui-disabled");
  });

  it("should render as a form with post method", () => {
    const { container } = renderWithProviders(<UserPasswordForm />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "post");
  });

  it("should dispatch setAuthStage to forgot when Forgot link is clicked", async () => {
    const { user, store } = renderWithProviders(<UserPasswordForm />);

    const forgotButton = screen.getByRole("button", { name: "Forgot?" });
    await user.click(forgotButton);

    // Check that the auth stage was changed to "forgot"
    const state = store.getState();
    expect(state.application.authFlow.stage).toBe("forgot");
  });

  it("should prevent default on forgot link click", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);

    const forgotButton = screen.getByRole("button", { name: "Forgot?" });

    // Click should not cause navigation or form submission
    await user.click(forgotButton);

    // The form should still be in the document (no navigation happened)
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });
});
