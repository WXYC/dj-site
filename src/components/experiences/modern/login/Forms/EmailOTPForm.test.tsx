import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import EmailOTPForm from "./EmailOTPForm";
import { renderWithProviders } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const QR_FLAG_KEY = "NEXT_PUBLIC_QR_LOGIN_ENABLED";

describe("EmailOTPForm", () => {
  const defaultProps = { onCodeSent: vi.fn() };

  it("should render identifier input", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByText("Username or email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username or email")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();
  });

  it("should have submit button disabled when email is empty", () => {
    renderWithProviders(<EmailOTPForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeDisabled();
  });

  it("should enable submit button when identifier is entered", async () => {
    const { user } = renderWithProviders(<EmailOTPForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Username or email"), "jbromberg");

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

  describe("QR entry link (flag-gated)", () => {
    afterEach(() => {
      delete process.env[QR_FLAG_KEY];
    });

    it("is hidden when the QR flag is off", () => {
      delete process.env[QR_FLAG_KEY];
      renderWithProviders(<EmailOTPForm {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: "Sign in with a QR code" })
      ).not.toBeInTheDocument();
    });

    it("switches to the qr stage when the flag is on", async () => {
      process.env[QR_FLAG_KEY] = "true";
      const { user, store } = renderWithProviders(
        <EmailOTPForm {...defaultProps} />
      );

      await user.click(
        screen.getByRole("button", { name: "Sign in with a QR code" })
      );

      expect(applicationSlice.selectors.getAuthStage(store.getState())).toBe(
        "qr"
      );
    });
  });
});
