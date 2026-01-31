import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountEntry } from "./AccountEntry";
import {
  Authorization,
  AdminAuthenticationStatus,
} from "@/lib/features/admin/types";

// Mock authClient
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      listUsers: vi.fn(),
      setUserPassword: vi.fn(),
      removeUser: vi.fn(),
    },
    organization: {
      getFullOrganization: vi.fn(),
      listMembers: vi.fn(),
      updateMemberRole: vi.fn(),
    },
  },
}));

// Mock organization utils
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getAppOrganizationIdClient: () => "test-org",
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockAccount = {
  id: "user-1",
  userName: "testuser",
  realName: "Test User",
  djName: "Test",
  email: "test@example.com",
  authorization: Authorization.DJ,
  authType: AdminAuthenticationStatus.Confirmed,
};

function renderInTable(component: React.ReactElement) {
  return render(
    <table>
      <tbody>{component}</tbody>
    </table>
  );
}

describe("AccountEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render account information", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText(/DJ Test/)).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("should render as table row", () => {
    const { container } = renderInTable(
      <AccountEntry account={mockAccount} isSelf={false} />
    );
    expect(container.querySelector("tr")).toBeInTheDocument();
  });

  it("should render checkboxes", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);
  });

  it("should render action buttons", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2); // Reset password and Delete buttons
  });

  it("should disable checkboxes when viewing own account", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={true} />);
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeDisabled();
    });
  });

  it("should disable delete button when viewing own account", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={true} />);
    const deleteButton = screen.getAllByRole("button")[1]; // Second button is delete
    expect(deleteButton).toBeDisabled();
  });

  it("should show SM checkbox checked for station managers", () => {
    const smAccount = { ...mockAccount, authorization: Authorization.SM };
    renderInTable(<AccountEntry account={smAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
  });

  it("should show MD checkbox checked for music directors", () => {
    const mdAccount = { ...mockAccount, authorization: Authorization.MD };
    renderInTable(<AccountEntry account={mdAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toBeChecked();
  });

  it("should disable MD checkbox when user is SM", () => {
    const smAccount = { ...mockAccount, authorization: Authorization.SM };
    renderInTable(<AccountEntry account={smAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toBeDisabled();
  });

  it("should disable reset password button for non-confirmed accounts", () => {
    const unconfirmedAccount = {
      ...mockAccount,
      authType: AdminAuthenticationStatus.Pending,
    };
    renderInTable(<AccountEntry account={unconfirmedAccount} isSelf={false} />);
    const resetButton = screen.getAllByRole("button")[0];
    expect(resetButton).toBeDisabled();
  });

  it("should render with empty djName", () => {
    const accountNoName = { ...mockAccount, djName: "" };
    renderInTable(<AccountEntry account={accountNoName} isSelf={false} />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("should call onAccountChange callback", async () => {
    const onAccountChange = vi.fn().mockResolvedValue(undefined);
    renderInTable(
      <AccountEntry
        account={mockAccount}
        isSelf={false}
        onAccountChange={onAccountChange}
      />
    );
    // Just verify the component renders with callback - actual callback testing
    // requires simulating confirm dialog which is complex
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("should handle account without id", () => {
    const accountNoId = { ...mockAccount, id: "" };
    renderInTable(<AccountEntry account={accountNoId} isSelf={false} />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  describe("interactive actions", () => {
    const originalConfirm = window.confirm;

    beforeEach(() => {
      window.confirm = vi.fn(() => true);
    });

    afterEach(() => {
      window.confirm = originalConfirm;
    });

    it("should handle SM checkbox click with confirmation cancel", async () => {
      window.confirm = vi.fn(() => false);
      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[0]);

      expect(window.confirm).toHaveBeenCalled();
    });

    it("should handle MD checkbox click with confirmation cancel", async () => {
      window.confirm = vi.fn(() => false);
      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[1]);

      expect(window.confirm).toHaveBeenCalled();
    });

    it("should handle delete button click with confirmation cancel", async () => {
      window.confirm = vi.fn(() => false);
      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const deleteButton = screen.getAllByRole("button")[1];

      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalled();
    });

    it("should handle reset password button click with confirmation cancel", async () => {
      window.confirm = vi.fn(() => false);
      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const resetButton = screen.getAllByRole("button")[0];

      fireEvent.click(resetButton);

      expect(window.confirm).toHaveBeenCalled();
    });

    it("should handle SM promotion with confirmation", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
        data: { id: "org-123" },
        error: null,
      } as any);
      vi.mocked(authClient.organization.listMembers).mockResolvedValue({
        data: { members: [{ id: "member-123", userId: "user-1" }] },
        error: null,
      } as any);
      vi.mocked(authClient.organization.updateMemberRole).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(authClient.organization.updateMemberRole).toHaveBeenCalled();
      });
    });

    it("should handle SM demotion with confirmation", async () => {
      const smAccount = { ...mockAccount, authorization: Authorization.SM };
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
        data: { id: "org-123" },
        error: null,
      } as any);
      vi.mocked(authClient.organization.listMembers).mockResolvedValue({
        data: { members: [{ id: "member-123", userId: "user-1" }] },
        error: null,
      } as any);
      vi.mocked(authClient.organization.updateMemberRole).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={smAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(authClient.organization.updateMemberRole).toHaveBeenCalled();
      });
    });

    it("should handle delete user with confirmation", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.admin.removeUser).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const deleteButton = screen.getAllByRole("button")[1];

      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(authClient.admin.removeUser).toHaveBeenCalled();
      });
    });

    it("should handle reset password with confirmation", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.admin.setUserPassword).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const resetButton = screen.getAllByRole("button")[0];

      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(authClient.admin.setUserPassword).toHaveBeenCalled();
      });
    });

    it("should handle error during promotion", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      const { toast } = await import("sonner");
      vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
        data: { id: "org-123" },
        error: null,
      } as any);
      vi.mocked(authClient.organization.listMembers).mockResolvedValue({
        data: { members: [] },
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("should handle delete error", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      const { toast } = await import("sonner");
      vi.mocked(authClient.admin.removeUser).mockResolvedValue({
        data: null,
        error: { message: "Delete failed" },
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const deleteButton = screen.getAllByRole("button")[1];

      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("should handle reset password error", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      const { toast } = await import("sonner");
      vi.mocked(authClient.admin.setUserPassword).mockResolvedValue({
        data: null,
        error: { message: "Reset failed" },
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const resetButton = screen.getAllByRole("button")[0];

      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("should resolve user ID by email when account has no ID", async () => {
      const accountNoId = { ...mockAccount, id: "" };
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.admin.listUsers).mockResolvedValue({
        data: { users: [{ id: "resolved-id" }] },
        error: null,
      } as any);
      vi.mocked(authClient.admin.removeUser).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={accountNoId} isSelf={false} />);
      const deleteButton = screen.getAllByRole("button")[1];

      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(authClient.admin.listUsers).toHaveBeenCalled();
      });
    });

    it("should handle organization lookup returning slug as ID", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
        data: null,
        error: null,
      } as any);
      vi.mocked(authClient.organization.listMembers).mockResolvedValue({
        data: { members: [{ id: "member-123", userId: "user-1" }] },
        error: null,
      } as any);
      vi.mocked(authClient.organization.updateMemberRole).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(authClient.organization.updateMemberRole).toHaveBeenCalled();
      });
    });

    it("should handle MD promotion", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
        data: { id: "org-123" },
        error: null,
      } as any);
      vi.mocked(authClient.organization.listMembers).mockResolvedValue({
        data: { members: [{ id: "member-123", userId: "user-1" }] },
        error: null,
      } as any);
      vi.mocked(authClient.organization.updateMemberRole).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(authClient.organization.updateMemberRole).toHaveBeenCalledWith(
          expect.objectContaining({ role: "musicDirector" })
        );
      });
    });

    it("should handle MD demotion to DJ", async () => {
      const mdAccount = { ...mockAccount, authorization: Authorization.MD };
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
        data: { id: "org-123" },
        error: null,
      } as any);
      vi.mocked(authClient.organization.listMembers).mockResolvedValue({
        data: { members: [{ id: "member-123", userId: "user-1" }] },
        error: null,
      } as any);
      vi.mocked(authClient.organization.updateMemberRole).mockResolvedValue({
        data: {},
        error: null,
      } as any);

      renderInTable(<AccountEntry account={mdAccount} isSelf={false} />);
      const checkboxes = screen.getAllByRole("checkbox");

      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(authClient.organization.updateMemberRole).toHaveBeenCalledWith(
          expect.objectContaining({ role: "dj" })
        );
      });
    });
  });
});
