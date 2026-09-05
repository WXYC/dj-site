import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import AccountEditForm from "@/src/components/experiences/modern/admin/roster/AccountEditForm";
import { createComponentHarness, createTestAccountResult } from "@/tests/helpers";
import { Authorization, type Account } from "@/lib/features/admin/types";

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

import { authClient } from "@/lib/features/authentication/client";
import { adminApi } from "@/lib/features/admin/api";
import { toast } from "sonner";

const mockUpdateUser = authClient.admin.updateUser as ReturnType<typeof vi.fn>;
const mockListUsers = authClient.admin.listUsers as ReturnType<typeof vi.fn>;
// The roster-invalidation bus was replaced by RTK Query tag invalidation; a
// successful mutation now dispatches adminApi.util.invalidateTags(["Roster"]).
const invalidateRoster = vi.spyOn(adminApi.util, "invalidateTags");

function makeAccount(overrides: Partial<Account> = {}): Account {
  return createTestAccountResult({
    id: "user-123",
    realName: "Juana Molina",
    djName: "DJ Juana",
    ...overrides,
  });
}

const setup = createComponentHarness(AccountEditForm, {
  account: makeAccount(),
  isSelf: false,
  onClose: () => {},
  organizationSlug: "wxyc",
  viewerRole: Authorization.SM,
  viewerId: "user-sm",
});

describe("AccountEditForm name editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: {} });
  });

  it("should render real name and DJ name inputs prefilled from the account", () => {
    setup();

    expect(screen.getByLabelText("Real Name")).toHaveValue("Juana Molina");
    expect(screen.getByLabelText("DJ Name")).toHaveValue("DJ Juana");
  });

  it("should render an empty DJ name input when the account has no DJ name", () => {
    setup({ account: makeAccount({ djName: undefined }) });

    expect(screen.getByLabelText("DJ Name")).toHaveValue("");
  });

  it("should not show a Save button until a field is edited", () => {
    setup();

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("should not show a Save button when the edit is only surrounding whitespace", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Real Name"), "  ");

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("should not offer Save when the real name is cleared", async () => {
    const { user } = setup();

    await user.clear(screen.getByLabelText("Real Name"));

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("should save an edited real name via admin.updateUser", async () => {
    const { user } = setup();

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
    expect(invalidateRoster).toHaveBeenCalledWith(["Roster"]);
  });

  it("should save an edited DJ name via admin.updateUser", async () => {
    const { user } = setup();

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
    expect(invalidateRoster).toHaveBeenCalledWith(["Roster"]);
  });

  it("should trim surrounding whitespace before saving", async () => {
    const { user } = setup();

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
    const { user } = setup();

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
    const { user } = setup();

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
    const { user } = setup();

    await user.clear(screen.getByLabelText("DJ Name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });
  });

  it("should disable name inputs when editing your own account", () => {
    setup({ isSelf: true });

    expect(screen.getByLabelText("Real Name")).toBeDisabled();
    expect(screen.getByLabelText("DJ Name")).toBeDisabled();
  });

  it("should show an error toast and not refresh the roster when the update fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "Update rejected" } });
    const { user } = setup();

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

describe("AccountEditForm approve action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: {} });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const pendingAccount = () => makeAccount({ selfSignupAt: new Date("2026-08-01T00:00:00Z") });

  it("offers to approve a self-signed account still pending review", () => {
    setup({ account: pendingAccount() });

    expect(screen.getByRole("button", { name: "Approve Self-Signup" })).toBeInTheDocument();
  });

  it("does not offer to approve an account that was never self-signed", () => {
    setup({ account: makeAccount() });

    expect(screen.queryByRole("button", { name: "Approve Self-Signup" })).not.toBeInTheDocument();
  });

  it("does not offer to approve an account already reviewed", () => {
    setup({
      account: makeAccount({
        selfSignupAt: new Date("2026-08-01T00:00:00Z"),
        selfSignupReviewedAt: new Date("2026-08-02T00:00:00Z"),
      }),
    });

    expect(screen.queryByRole("button", { name: "Approve Self-Signup" })).not.toBeInTheDocument();
  });

  // Gate 1: !isSelf. A manager cannot approve their own pending self-signup.
  it("does not offer to approve your own account, even pending", () => {
    setup({ account: pendingAccount(), isSelf: true });

    expect(screen.queryByRole("button", { name: "Approve Self-Signup" })).not.toBeInTheDocument();
  });

  // Gate 2: viewer role. Defense-in-depth for a future non-SM dispatcher of
  // this form — see the module doc on the "account-edit" panel case.
  it("does not offer to approve when the viewer is below station-manager", () => {
    setup({ account: pendingAccount(), viewerRole: Authorization.MD });

    expect(screen.queryByRole("button", { name: "Approve Self-Signup" })).not.toBeInTheDocument();
  });

  it("approves via admin.updateUser, writing both review fields", async () => {
    const { user } = setup({ account: pendingAccount() });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        userId: "user-123",
        data: {
          selfSignupReviewedAt: expect.any(String),
          selfSignupReviewedBy: "user-sm",
        },
      });
    });
    expect(toast.success).toHaveBeenCalled();
    expect(invalidateRoster).toHaveBeenCalledWith(["Roster"]);
  });

  it("shows an error toast and does not refresh the roster when approval fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "Approval rejected" } });
    const { user } = setup({ account: pendingAccount() });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Approval rejected");
    });
    expect(invalidateRoster).not.toHaveBeenCalled();
  });
});
