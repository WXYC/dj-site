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
  useSearchParams: () => new URLSearchParams(),
}));

describe("NewUserForm", () => {
  const defaultProps: IncompleteUser = {
    username: "testuser",
    requiredAttributes: ["realName"],
  };

  it("should render submit button", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should render required attributes as fields", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByText("Real Name")).toBeInTheDocument();
  });

  it("should render DJ name as an optional field", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByText("DJ Name (optional)")).toBeInTheDocument();
  });

  it("should not render password fields — a signed-in user keeps their password", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.queryByText("New Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm New Password")).not.toBeInTheDocument();
  });

  it("should have submit button disabled until required fields are filled", () => {
    renderWithProviders(<NewUserForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should enable submit when required fields are filled", async () => {
    const { user } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const realNameInput = screen.getByPlaceholderText("Real Name");
    await user.type(realNameInput, "Test User");

    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("should render as a form with put method", () => {
    const { container } = renderWithProviders(<NewUserForm {...defaultProps} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "put");
  });
});
