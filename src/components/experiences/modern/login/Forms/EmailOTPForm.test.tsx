import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import EmailOTPForm from "./EmailOTPForm";
import { renderWithProviders } from "@/lib/test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("EmailOTPForm", () => {
  const defaultProps = { onCodeSent: vi.fn() };

  it("should render email input", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();
  });

  it("should have submit button disabled when email is empty", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeDisabled();
  });

  it("should enable submit button when email is entered", async () => {
    const { user } = renderWithProviders(<EmailOTPForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "dj@wxyc.org");

    expect(screen.getByRole("button", { name: "Send login code" })).not.toBeDisabled();
  });

  it("should render helper text", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByText(/6-digit code/)).toBeInTheDocument();
  });

  it("should render password fallback link", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Sign in with password instead" })).toBeInTheDocument();
  });

  it("should render as a form with post method", () => {
    const { container } = renderWithProviders(<EmailOTPForm {...defaultProps} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "post");
  });
});
