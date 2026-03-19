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

  it("should not render password fields", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.queryByText("New Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm New Password")).not.toBeInTheDocument();
  });

  it("should render required attributes as fields", () => {
    const props: IncompleteUser = {
      username: "testuser",
      requiredAttributes: ["realName", "djName"],
    };
    renderWithProviders(<NewUserForm {...props} />);

    expect(screen.getByText("Real Name")).toBeInTheDocument();
    expect(screen.getByText("DJ Name")).toBeInTheDocument();
  });

  it("should have hidden username input", () => {
    const { container } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const hiddenInput = container.querySelector('input[name="username"]');
    expect(hiddenInput).toHaveAttribute("type", "hidden");
    expect(hiddenInput).toHaveValue("testuser");
  });

  it("should enable submit when required attributes are filled", async () => {
    const props: IncompleteUser = {
      username: "testuser",
      requiredAttributes: ["realName"],
    };
    const { user } = renderWithProviders(<NewUserForm {...props} />);

    const realNameInput = screen.getByPlaceholderText("Real Name");
    await user.type(realNameInput, "Test DJ");

    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("should render as a form with put method", () => {
    const { container } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "put");
  });
});
