import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import AccountEditForm from "./AccountEditForm";
import { renderWithProviders, createTestAccountResult } from "@/lib/test-utils";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: { listUsers: vi.fn(), updateUser: vi.fn(), removeUser: vi.fn(), setUserPassword: vi.fn() },
    organization: { listMembers: vi.fn(), updateMemberRole: vi.fn() },
    requestPasswordReset: vi.fn(),
  },
  authBaseURL: "http://localhost:8082/auth",
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  resolveOrganizationIdAdmin: vi.fn(() => Promise.resolve("resolved-org-id")),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/features/admin/roster-events", () => ({
  invalidateRoster: vi.fn(),
}));

import { authClient } from "@/lib/features/authentication/client";
import { invalidateRoster } from "@/lib/features/admin/roster-events";
import { toast } from "sonner";

const mockUpdateUser = authClient.admin.updateUser as ReturnType<typeof vi.fn>;
const mockListUsers = authClient.admin.listUsers as ReturnType<typeof vi.fn>;

function renderForm(
  accountOverrides: Parameters<typeof createTestAccountResult>[0] = {},
  isSelf = false
) {
  const account = createTestAccountResult({
    id: "user-123",
    realName: "Juana Molina",
    djName: "DJ Juana",
    ...accountOverrides,
  });
  const result = renderWithProviders(
    <AccountEditForm
      account={account}
      isSelf={isSelf}
      onClose={vi.fn()}
      organizationSlug="wxyc"
    />
  );
  return { account, ...result };
}

describe("AccountEditForm name editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: {} });
  });

  it("should render real name and DJ name inputs prefilled from the account", () => {
    renderForm();

    expect(screen.getByLabelText("Real Name")).toHaveValue("Juana Molina");
    expect(screen.getByLabelText("DJ Name")).toHaveValue("DJ Juana");
  });

  it("should render an empty DJ name input when the account has no DJ name", () => {
    renderForm({ djName: undefined });

    expect(screen.getByLabelText("DJ Name")).toHaveValue("");
  });

  it("should not show a Save button until a field is edited", () => {
    renderForm();

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("should not show a Save button when the edit is only surrounding whitespace", async () => {
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Real Name"), "  ");

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("should not offer Save when the real name is cleared", async () => {
    const { user } = renderForm();

    await user.clear(screen.getByLabelText("Real Name"));

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("should save an edited real name via admin.updateUser", async () => {
    const { user } = renderForm();

    const input = screen.getByLabelText("Real Name");
    await user.clear(input);
    await user.type(input, "Jessica Pratt");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        userId: "user-123",
        data: { realName: "Jessica Pratt" },
      });
    });
    expect(mockListUsers).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(invalidateRoster).toHaveBeenCalled();
  });

  it("should save an edited DJ name via admin.updateUser", async () => {
    const { user } = renderForm();

    const input = screen.getByLabelText("DJ Name");
    await user.clear(input);
    await user.type(input, "DJ Cat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        userId: "user-123",
        data: { djName: "DJ Cat" },
      });
    });
    expect(toast.success).toHaveBeenCalled();
    expect(invalidateRoster).toHaveBeenCalled();
  });

  it("should trim surrounding whitespace before saving", async () => {
    const { user } = renderForm();

    const input = screen.getByLabelText("Real Name");
    await user.clear(input);
    await user.type(input, "  Jessica Pratt  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        userId: "user-123",
        data: { realName: "Jessica Pratt" },
      });
    });
  });

  it("should allow clearing the DJ name", async () => {
    const { user } = renderForm();

    await user.clear(screen.getByLabelText("DJ Name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        userId: "user-123",
        data: { djName: "" },
      });
    });
  });

  it("should hide the Save button after a successful save", async () => {
    const { user } = renderForm();

    const input = screen.getByLabelText("Real Name");
    await user.clear(input);
    await user.type(input, "Jessica Pratt");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });
    expect(input).toHaveValue("Jessica Pratt");
  });

  it("should hide the Save button after clearing the DJ name and saving", async () => {
    const { user } = renderForm();

    await user.clear(screen.getByLabelText("DJ Name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });
  });

  it("should disable name inputs when editing your own account", () => {
    renderForm({}, true);

    expect(screen.getByLabelText("Real Name")).toBeDisabled();
    expect(screen.getByLabelText("DJ Name")).toBeDisabled();
  });

  it("should show an error toast and not refresh the roster when the update fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "Update rejected" } });
    const { user } = renderForm();

    const input = screen.getByLabelText("Real Name");
    await user.clear(input);
    await user.type(input, "Jessica Pratt");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update rejected");
    });
    expect(invalidateRoster).not.toHaveBeenCalled();
  });
});
