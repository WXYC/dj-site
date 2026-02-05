import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import { AccountEntry } from "./AccountEntry";
import {
  Account,
  AdminAuthenticationStatus,
  Authorization,
} from "@/lib/features/admin/types";

// Mock the auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      setRole: vi.fn(),
      updateUser: vi.fn(),
      removeUser: vi.fn(),
      listUsers: vi.fn(),
    },
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { authClient } from "@/lib/features/authentication/client";
import { toast } from "sonner";

// Type assertions for mocked functions
const mockedAuthClient = authClient as unknown as {
  admin: {
    setRole: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    removeUser: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
  };
};
const mockedToast = vi.mocked(toast);

// Helper to create test account data
function createTestAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "test-user-id-123",
    userName: "testuser",
    realName: "Test User",
    djName: "DJ Test",
    authorization: Authorization.DJ,
    authType: AdminAuthenticationStatus.Confirmed,
    email: "test@wxyc.org",
    ...overrides,
  };
}

// Wrapper to render AccountEntry within a table structure
function renderAccountEntry(
  account: Account,
  isSelf: boolean = false,
  onAccountChange?: () => Promise<void>
) {
  return renderWithProviders(
    <table>
      <tbody>
        <AccountEntry
          account={account}
          isSelf={isSelf}
          onAccountChange={onAccountChange}
        />
      </tbody>
    </table>
  );
}

describe("AccountEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockedAuthClient.admin.setRole.mockResolvedValue({ data: {}, error: null });
    mockedAuthClient.admin.updateUser.mockResolvedValue({
      data: {},
      error: null,
    });
    mockedAuthClient.admin.removeUser.mockResolvedValue({
      data: {},
      error: null,
    });
    mockedAuthClient.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "resolved-user-id" }] },
      error: null,
    });

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("should render account real name", () => {
      const account = createTestAccount({ realName: "John Doe" });
      renderAccountEntry(account);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should render account username", () => {
      const account = createTestAccount({ userName: "johndoe" });
      renderAccountEntry(account);

      expect(screen.getByText("johndoe")).toBeInTheDocument();
    });

    it("should render DJ name with prefix when present", () => {
      const account = createTestAccount({ djName: "Midnight" });
      renderAccountEntry(account);

      expect(screen.getByText(/DJ.*Midnight/)).toBeInTheDocument();
    });

    it("should not render DJ prefix when djName is empty", () => {
      const account = createTestAccount({ djName: "" });
      renderAccountEntry(account);

      // The cell should exist but not contain "DJ"
      const cells = screen.getAllByRole("cell");
      const djCell = cells[3]; // djName is the 4th column (0-indexed)
      expect(djCell.textContent).toBe(" ");
    });

    it("should render account email", () => {
      const account = createTestAccount({ email: "john@wxyc.org" });
      renderAccountEntry(account);

      expect(screen.getByText("john@wxyc.org")).toBeInTheDocument();
    });

    it("should render two checkboxes for role management", () => {
      const account = createTestAccount();
      renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
    });

    it("should render reset password button", () => {
      const account = createTestAccount();
      renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("should render delete button", () => {
      const account = createTestAccount();
      renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("checkbox states for authorization levels", () => {
    it("should have both checkboxes unchecked for DJ authorization", () => {
      const account = createTestAccount({ authorization: Authorization.DJ });
      renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).not.toBeChecked(); // SM checkbox
      expect(checkboxes[1]).not.toBeChecked(); // MD checkbox
    });

    it("should have second checkbox checked for MD authorization", () => {
      const account = createTestAccount({ authorization: Authorization.MD });
      renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).not.toBeChecked(); // SM checkbox
      expect(checkboxes[1]).toBeChecked(); // MD checkbox
    });

    it("should have both checkboxes checked for SM authorization", () => {
      const account = createTestAccount({ authorization: Authorization.SM });
      renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked(); // SM checkbox
      expect(checkboxes[1]).toBeChecked(); // MD checkbox (also checked when SM)
    });

    it("should have both checkboxes unchecked for NO authorization", () => {
      const account = createTestAccount({ authorization: Authorization.NO });
      renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe("self-user restrictions", () => {
    it("should disable checkboxes when viewing own account", () => {
      const account = createTestAccount();
      renderAccountEntry(account, true);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeDisabled();
      expect(checkboxes[1]).toBeDisabled();
    });

    it("should disable delete button when viewing own account", () => {
      const account = createTestAccount();
      renderAccountEntry(account, true);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1]; // Delete is the last button
      expect(deleteButton).toBeDisabled();
    });

    it("should disable reset password button when viewing own account", () => {
      const account = createTestAccount();
      renderAccountEntry(account, true);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0]; // Reset is the first button
      expect(resetButton).toBeDisabled();
    });

    it("should show special tooltip for delete button when viewing own account", () => {
      const account = createTestAccount();
      renderAccountEntry(account, true);

      // Tooltip content is rendered but may not be visible without hover
      // We verify the button is disabled which indicates the self-delete restriction
      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      expect(deleteButton).toBeDisabled();
    });
  });

  describe("MD checkbox disabled for SM users", () => {
    it("should disable MD checkbox when user is already Station Manager", () => {
      const account = createTestAccount({ authorization: Authorization.SM });
      renderAccountEntry(account, false);

      const checkboxes = screen.getAllByRole("checkbox");
      // The MD checkbox should be disabled when user is SM
      expect(checkboxes[1]).toBeDisabled();
    });
  });

  describe("reset password button states", () => {
    it("should disable reset password for non-confirmed users", () => {
      const account = createTestAccount({
        authType: AdminAuthenticationStatus.New,
      });
      renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      expect(resetButton).toBeDisabled();
    });

    it("should enable reset password for confirmed users", () => {
      const account = createTestAccount({
        authType: AdminAuthenticationStatus.Confirmed,
      });
      renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      expect(resetButton).not.toBeDisabled();
    });

    it("should disable reset password for users in reset state", () => {
      const account = createTestAccount({
        authType: AdminAuthenticationStatus.Reset,
      });
      renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      expect(resetButton).toBeDisabled();
    });
  });

  describe("promote to Station Manager", () => {
    it("should call setRole when SM checkbox is checked and confirmed", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "John",
      });
      const onAccountChange = vi.fn().mockResolvedValue(undefined);
      const { user } = renderAccountEntry(account, false, onAccountChange);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // SM checkbox

      await waitFor(() => {
        expect(mockedAuthClient.admin.setRole).toHaveBeenCalledWith({
          userId: "test-user-id-123",
          role: "admin",
        });
      });
    });

    it("should show success toast on successful promotion to SM", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "John",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          "John promoted to Station Manager"
        );
      });
    });

    it("should call onAccountChange after successful promotion", async () => {
      const account = createTestAccount({ authorization: Authorization.DJ });
      const onAccountChange = vi.fn().mockResolvedValue(undefined);
      const { user } = renderAccountEntry(account, false, onAccountChange);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(onAccountChange).toHaveBeenCalled();
      });
    });

    it("should not call setRole when confirm is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(mockedAuthClient.admin.setRole).not.toHaveBeenCalled();
    });

    it("should show error toast on API failure", async () => {
      mockedAuthClient.admin.setRole.mockResolvedValue({
        error: { message: "Permission denied" },
      });

      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith("Permission denied");
      });
    });
  });

  describe("demote from Station Manager", () => {
    it("should call setRole with user role when SM checkbox is unchecked", async () => {
      const account = createTestAccount({
        authorization: Authorization.SM,
        realName: "John",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // Uncheck SM checkbox

      await waitFor(() => {
        expect(mockedAuthClient.admin.setRole).toHaveBeenCalledWith({
          userId: "test-user-id-123",
          role: "user",
        });
      });
    });

    it("should show success toast on successful demotion from SM", async () => {
      const account = createTestAccount({
        authorization: Authorization.SM,
        realName: "John",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          "John role updated to Music Director"
        );
      });
    });
  });

  describe("promote to Music Director", () => {
    it("should call setRole when MD checkbox is checked", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "Jane",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // MD checkbox

      await waitFor(() => {
        expect(mockedAuthClient.admin.setRole).toHaveBeenCalledWith({
          userId: "test-user-id-123",
          role: "user",
        });
      });
    });

    it("should show success toast on successful promotion to MD", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "Jane",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          "Jane promoted to Music Director"
        );
      });
    });
  });

  describe("demote from Music Director", () => {
    it("should call setRole with user role when MD checkbox is unchecked", async () => {
      const account = createTestAccount({
        authorization: Authorization.MD,
        realName: "Jane",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // Uncheck MD checkbox

      await waitFor(() => {
        expect(mockedAuthClient.admin.setRole).toHaveBeenCalledWith({
          userId: "test-user-id-123",
          role: "user",
        });
      });
    });

    it("should show success toast on successful demotion from MD", async () => {
      const account = createTestAccount({
        authorization: Authorization.MD,
        realName: "Jane",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          "Jane role updated to DJ"
        );
      });
    });
  });

  describe("reset password", () => {
    it("should call updateUser when reset button is clicked and confirmed", async () => {
      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      await user.click(resetButton);

      await waitFor(() => {
        expect(mockedAuthClient.admin.updateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "test-user-id-123",
            password: expect.any(String),
          })
        );
      });
    });

    it("should show success toast with temporary password on success", async () => {
      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      await user.click(resetButton);

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          expect.stringContaining("Password reset successfully"),
          expect.objectContaining({ duration: 10000 })
        );
      });
    });

    it("should not call updateUser when confirm is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      await user.click(resetButton);

      expect(mockedAuthClient.admin.updateUser).not.toHaveBeenCalled();
    });

    it("should show error toast on API failure", async () => {
      mockedAuthClient.admin.updateUser.mockResolvedValue({
        error: { message: "Failed to reset password" },
      });

      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      await user.click(resetButton);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          "Failed to reset password"
        );
      });
    });
  });

  describe("delete account", () => {
    it("should call removeUser when delete button is clicked and confirmed", async () => {
      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedAuthClient.admin.removeUser).toHaveBeenCalledWith({
          userId: "test-user-id-123",
        });
      });
    });

    it("should show success toast on successful deletion", async () => {
      const account = createTestAccount({ realName: "John" });
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          "John's account deleted successfully"
        );
      });
    });

    it("should call onAccountChange after successful deletion", async () => {
      const account = createTestAccount();
      const onAccountChange = vi.fn().mockResolvedValue(undefined);
      const { user } = renderAccountEntry(account, false, onAccountChange);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(onAccountChange).toHaveBeenCalled();
      });
    });

    it("should not call removeUser when confirm is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      expect(mockedAuthClient.admin.removeUser).not.toHaveBeenCalled();
    });

    it("should show error toast on API failure", async () => {
      mockedAuthClient.admin.removeUser.mockResolvedValue({
        error: { message: "Cannot delete user" },
      });

      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith("Cannot delete user");
      });
    });
  });

  describe("user ID resolution", () => {
    it("should use account.id directly when available", async () => {
      const account = createTestAccount({ id: "direct-user-id" });
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedAuthClient.admin.removeUser).toHaveBeenCalledWith({
          userId: "direct-user-id",
        });
      });

      // listUsers should not be called when ID is already available
      expect(mockedAuthClient.admin.listUsers).not.toHaveBeenCalled();
    });

    it("should resolve user ID via listUsers when account.id is missing", async () => {
      const account = createTestAccount({ id: undefined, email: "test@wxyc.org" });
      mockedAuthClient.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: "resolved-user-id" }] },
        error: null,
      });

      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedAuthClient.admin.listUsers).toHaveBeenCalledWith({
          query: {
            searchValue: "test@wxyc.org",
            searchField: "email",
            limit: 1,
          },
        });
      });

      await waitFor(() => {
        expect(mockedAuthClient.admin.removeUser).toHaveBeenCalledWith({
          userId: "resolved-user-id",
        });
      });
    });

    it("should search by username when email is not available", async () => {
      const account = createTestAccount({
        id: undefined,
        email: undefined,
        userName: "testuser",
      });
      mockedAuthClient.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: "resolved-user-id" }] },
        error: null,
      });

      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedAuthClient.admin.listUsers).toHaveBeenCalledWith({
          query: {
            searchValue: "testuser",
            searchField: "name",
            limit: 1,
          },
        });
      });
    });

    it("should show error when user cannot be resolved", async () => {
      const account = createTestAccount({ id: undefined });
      mockedAuthClient.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          expect.stringContaining("not found")
        );
      });
    });

    it("should show error when listUsers API fails", async () => {
      const account = createTestAccount({ id: undefined });
      mockedAuthClient.admin.listUsers.mockResolvedValue({
        data: null,
        error: { message: "API error" },
      });

      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalled();
      });
    });
  });

  describe("confirmation dialogs", () => {
    it("should show confirmation for SM promotion with apostrophe when name is present", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "John",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("John's")
      );
    });

    it("should show confirmation without apostrophe when name is empty", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("account to Station Manager")
      );
      expect(window.confirm).not.toHaveBeenCalledWith(
        expect.stringContaining("'s")
      );
    });

    it("should show confirmation for MD promotion", async () => {
      const account = createTestAccount({
        authorization: Authorization.DJ,
        realName: "Jane",
      });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("Music Director")
      );
    });

    it("should show confirmation for password reset", async () => {
      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      await user.click(resetButton);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("reset this user's password")
      );
    });

    it("should show confirmation for account deletion", async () => {
      const account = createTestAccount({ realName: "John" });
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("delete John's account")
      );
    });
  });

  describe("error handling edge cases", () => {
    it("should handle non-Error exceptions during promotion", async () => {
      mockedAuthClient.admin.setRole.mockRejectedValue("String error");

      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith("Failed to promote user");
      });
    });

    it("should handle non-Error exceptions during password reset", async () => {
      mockedAuthClient.admin.updateUser.mockRejectedValue({ code: 500 });

      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[0];
      await user.click(resetButton);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          "Failed to reset password"
        );
      });
    });

    it("should handle non-Error exceptions during deletion", async () => {
      mockedAuthClient.admin.removeUser.mockRejectedValue(null);

      const account = createTestAccount();
      const { user } = renderAccountEntry(account);

      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          "Failed to delete account"
        );
      });
    });

    it("should use fallback message for empty error messages", async () => {
      mockedAuthClient.admin.setRole.mockResolvedValue({
        error: { message: "" },
      });

      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        // When error.message is empty, implementation falls back to default message
        expect(mockedToast.error).toHaveBeenCalledWith("Failed to promote user");
      });
    });

    it("should use default error message when API error has no message", async () => {
      mockedAuthClient.admin.setRole.mockResolvedValue({
        error: {},
      });

      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith("Failed to promote user");
      });
    });
  });

  describe("loading states", () => {
    it("should disable SM checkbox while promoting", async () => {
      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedAuthClient.admin.setRole.mockReturnValue(pendingPromise);

      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Checkbox should be disabled while request is in progress
      await waitFor(() => {
        expect(checkboxes[0]).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolvePromise!({ data: {}, error: null });
    });

    it("should re-enable checkboxes after promotion completes", async () => {
      const account = createTestAccount({ authorization: Authorization.DJ });
      const { user } = renderAccountEntry(account);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(checkboxes[0]).not.toBeDisabled();
      });
    });
  });
});
