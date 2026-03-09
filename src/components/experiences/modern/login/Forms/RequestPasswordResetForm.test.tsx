import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RequestPasswordResetForm from "./RequestPasswordResetForm";

const mockHandleRequestReset = vi.fn();

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useResetPassword: () => ({
    handleRequestReset: mockHandleRequestReset,
    requestingReset: false,
  }),
}));

describe("RequestPasswordResetForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render form element", () => {
    render(<RequestPasswordResetForm />);
    expect(document.querySelector("form")).toBeInTheDocument();
  });

  it("should render email input", () => {
    render(<RequestPasswordResetForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("should render email placeholder", () => {
    render(<RequestPasswordResetForm />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    render(<RequestPasswordResetForm />);
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("should render helper text", () => {
    render(<RequestPasswordResetForm />);
    expect(
      screen.getByText(/send a reset link if the email exists/i)
    ).toBeInTheDocument();
  });

  it("should have disabled submit button when email is empty", () => {
    render(<RequestPasswordResetForm />);
    const button = screen.getByRole("button", { name: /send reset link/i });
    expect(button).toBeDisabled();
  });

  it("should enable submit button when email is entered", () => {
    render(<RequestPasswordResetForm />);
    const input = screen.getByLabelText(/email/i);
    fireEvent.change(input, { target: { value: "test@example.com" } });

    const button = screen.getByRole("button", { name: /send reset link/i });
    expect(button).not.toBeDisabled();
  });

  it("should call handleRequestReset on form submit", () => {
    render(<RequestPasswordResetForm />);
    const input = screen.getByLabelText(/email/i);
    fireEvent.change(input, { target: { value: "test@example.com" } });

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    expect(mockHandleRequestReset).toHaveBeenCalledWith("test@example.com");
  });

  it("should trim email before submitting", () => {
    render(<RequestPasswordResetForm />);
    const input = screen.getByLabelText(/email/i);
    fireEvent.change(input, { target: { value: "  test@example.com  " } });

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    expect(mockHandleRequestReset).toHaveBeenCalledWith("test@example.com");
  });
});
