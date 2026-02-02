import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import EmailChangeModal from "@/src/components/experiences/modern/settings/EmailChangeModal";

// Mock the auth client
const mockChangeEmail = vi.fn();
const mockSignInUsername = vi.fn();

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    changeEmail: (...args: unknown[]) => mockChangeEmail(...args),
    signIn: {
      username: (...args: unknown[]) => mockSignInUsername(...args),
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("EmailChangeModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    currentEmail: "current@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInUsername.mockResolvedValue({ data: { user: {} } });
    mockChangeEmail.mockResolvedValue({ data: { status: true } });
  });

  describe("Rendering", () => {
    it("should render the modal when open", () => {
      renderWithProviders(<EmailChangeModal {...defaultProps} />);

      expect(screen.getByText("Change Email Address")).toBeInTheDocument();
      expect(screen.getByText("Current Email")).toBeInTheDocument();
      expect(screen.getByText("New Email")).toBeInTheDocument();
      expect(screen.getByText("Current Password")).toBeInTheDocument();
    });

    it("should display current email as disabled input", () => {
      renderWithProviders(<EmailChangeModal {...defaultProps} />);

      const currentEmailInput = screen.getByDisplayValue("current@example.com");
      expect(currentEmailInput).toBeDisabled();
    });

    it("should not render when closed", () => {
      renderWithProviders(<EmailChangeModal {...defaultProps} open={false} />);

      expect(screen.queryByText("Change Email Address")).not.toBeInTheDocument();
    });

    it("should show Cancel and Send Verification Email buttons", () => {
      renderWithProviders(<EmailChangeModal {...defaultProps} />);

      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send Verification Email" })
      ).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should show error when submitting with empty fields", async () => {
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      expect(screen.getByText("Please fill in all fields")).toBeInTheDocument();
      expect(mockSignInUsername).not.toHaveBeenCalled();
    });

    it("should show error when new email is same as current", async () => {
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "current@example.com");
      await user.type(passwordInput, "password123");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      expect(
        screen.getByText("New email must be different from your current email")
      ).toBeInTheDocument();
      expect(mockSignInUsername).not.toHaveBeenCalled();
    });

    it("should show error for invalid email format", async () => {
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      // Use email that passes HTML5 validation (has @) but fails our regex (no dot in domain)
      await user.type(newEmailInput, "test@nodomain");
      await user.type(passwordInput, "password123");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeInTheDocument();
      expect(mockSignInUsername).not.toHaveBeenCalled();
    });
  });

  describe("Password Verification", () => {
    it("should verify password before changing email", async () => {
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "correctpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInUsername).toHaveBeenCalledWith({
          username: "current@example.com",
          password: "correctpassword",
        });
      });
    });

    it("should show error when password verification fails", async () => {
      mockSignInUsername.mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "wrongpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });
  });

  describe("Email Change API", () => {
    it("should call changeEmail API after successful password verification", async () => {
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "correctpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockChangeEmail).toHaveBeenCalledWith({
          newEmail: "new@example.com",
          callbackURL: expect.stringContaining("/dashboard/settings"),
        });
      });
    });

    it("should show error when changeEmail API fails", async () => {
      mockChangeEmail.mockResolvedValue({
        error: { message: "Email already in use" },
      });

      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "correctpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Email already in use")).toBeInTheDocument();
      });
    });
  });

  describe("Success State", () => {
    it("should show success state after successful email change request", async () => {
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "correctpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Check Your Inbox")).toBeInTheDocument();
      });

      expect(
        screen.getByText("We've sent a verification email to:")
      ).toBeInTheDocument();
      expect(screen.getByText("new@example.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    });

    it("should close modal when Done is clicked in success state", async () => {
      const onClose = vi.fn();
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} onClose={onClose} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "correctpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Check Your Inbox")).toBeInTheDocument();
      });

      const doneButton = screen.getByRole("button", { name: "Done" });
      await user.click(doneButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Modal Close Behavior", () => {
    it("should call onClose when Cancel is clicked", async () => {
      const onClose = vi.fn();
      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} onClose={onClose} />
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("should reset form state when modal is closed and reopened", async () => {
      const { user, rerender } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      // Fill in the form
      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");
      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "password123");

      // Close the modal
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      // Reopen the modal
      rerender(<EmailChangeModal {...defaultProps} open={true} />);

      // Fields should be cleared (modal creates new state on mount)
      const newEmailInputAfter = screen.getByPlaceholderText(
        "Enter your new email"
      );
      expect(newEmailInputAfter).toHaveValue("");
    });
  });

  describe("Loading State", () => {
    it("should disable inputs while loading", async () => {
      // Make the API call hang
      mockSignInUsername.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { user } = renderWithProviders(
        <EmailChangeModal {...defaultProps} />
      );

      const newEmailInput = screen.getByPlaceholderText("Enter your new email");
      const passwordInput = screen.getByPlaceholderText("Confirm your password");

      await user.type(newEmailInput, "new@example.com");
      await user.type(passwordInput, "correctpassword");

      const submitButton = screen.getByRole("button", {
        name: "Send Verification Email",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(newEmailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
      });
    });
  });
});
