import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import OTPCodeForm from "./OTPCodeForm";
import { renderWithProviders } from "@/lib/test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("OTPCodeForm", () => {
  const defaultProps = {
    email: "dj@wxyc.org",
    displayTarget: "dj@wxyc.org",
    onChangeIdentifier: vi.fn(),
  };

  it("should display the displayTarget verbatim", () => {
    renderWithProviders(<OTPCodeForm {...defaultProps} />);

    expect(screen.getByText("dj@wxyc.org")).toBeInTheDocument();
  });

  it("should not leak the resolved email when displayTarget is a placeholder", () => {
    renderWithProviders(
      <OTPCodeForm
        email="jbromberg@wxyc.org"
        displayTarget="your registered email"
        onChangeIdentifier={vi.fn()}
      />
    );

    expect(screen.queryByText("jbromberg@wxyc.org")).not.toBeInTheDocument();
    expect(screen.getByText("your registered email")).toBeInTheDocument();
  });

  it("should render code input", () => {
    renderWithProviders(<OTPCodeForm {...defaultProps} />);

    expect(screen.getByText("Login code")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithProviders(<OTPCodeForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("should have submit button disabled when code is incomplete", () => {
    renderWithProviders(<OTPCodeForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("should enable submit button when 6-digit code is entered", async () => {
    const { user } = renderWithProviders(<OTPCodeForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("000000"), "123456");

    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();
  });

  it("should only accept numeric input", async () => {
    const { user } = renderWithProviders(<OTPCodeForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("000000"), "abc123");

    expect(screen.getByPlaceholderText("000000")).toHaveValue("123");
  });

  it("should render resend and change-account links", () => {
    renderWithProviders(<OTPCodeForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Resend code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try a different account" })).toBeInTheDocument();
  });

  it("should render as a form with post method", () => {
    const { container } = renderWithProviders(<OTPCodeForm {...defaultProps} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "post");
  });
});
