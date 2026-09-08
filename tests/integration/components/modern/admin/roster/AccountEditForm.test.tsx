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
  authFetch: vi.fn(),
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

import { authClient, authFetch } from "@/lib/features/authentication/client";
import { adminApi } from "@/lib/features/admin/api";
import { toast } from "sonner";

const mockUpdateUser = authClient.admin.updateUser as ReturnType<typeof vi.fn>;
const mockListUsers = authClient.admin.listUsers as ReturnType<typeof vi.fn>;
const mockAuthFetch = authFetch as ReturnType<typeof vi.fn>;
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
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200, data: { userId: "user-123" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const pendingAccount = () => makeAccount({ selfSignupAt: "2026-08-01T00:00:00Z" });

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
        selfSignupAt: "2026-08-01T00:00:00Z",
        selfSignupReviewedAt: "2026-08-02T00:00:00Z",
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

  // The reviewer is derived from the session on the server, so the request
  // body carries ONLY the target and the role decision — never a
  // `selfSignupReviewedBy` or a `selfSignupReviewedAt`. It must hit the
  // dedicated approve endpoint, not better-auth's generic update-user, whose
  // `input: false` review columns would silently strip the write.
  it("approves via the dedicated station-signup endpoint with only userId and restoreDjRole", async () => {
    const { user } = setup({ account: pendingAccount() });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/admin/station-signup/approve", {
        method: "POST",
        json: { userId: "user-123", restoreDjRole: false },
      });
    });
    // The generic update-user path must not be used for approval.
    expect(mockUpdateUser).not.toHaveBeenCalled();
    // No reviewer id or review timestamp ever leaves the client.
    const [, init] = mockAuthFetch.mock.calls[0];
    expect(JSON.stringify(init)).not.toContain("selfSignupReviewedBy");
    expect(JSON.stringify(init)).not.toContain("selfSignupReviewedAt");
    expect(toast.success).toHaveBeenCalled();
    expect(invalidateRoster).toHaveBeenCalledWith(["Roster"]);
  });

  // The nightly review job downgrades an unreviewed self-signup from `dj` to
  // `member`; a pending account sitting at member-level authority is one that
  // was auto-downgraded, so approving it must ask the server to restore `dj`.
  it("asks the server to restore the dj role for a downgraded (member) self-signup", async () => {
    const { user } = setup({
      account: makeAccount({
        selfSignupAt: "2026-08-01T00:00:00Z",
        authorization: Authorization.NO,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/admin/station-signup/approve", {
        method: "POST",
        json: { userId: "user-123", restoreDjRole: true },
      });
    });
  });

  // `account` is a snapshot from when the panel opened, so nothing updates it
  // once a manager approves — `handleDelete` avoids the same drift by closing
  // the panel on success, and approve must do the same or the panel is left
  // showing "Approve Self-Signup" for a row the roster behind it no longer
  // badges as pending.
  it("closes the panel after a successful approval", async () => {
    const onClose = vi.fn();
    const { user } = setup({ account: pendingAccount(), onClose });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("does not close the panel when approval fails", async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 400, data: { error: "Approval rejected" } });
    const onClose = vi.fn();
    const { user } = setup({ account: pendingAccount(), onClose });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an error toast and does not refresh the roster when approval fails", async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 400, data: { error: "Approval rejected" } });
    const { user } = setup({ account: pendingAccount() });

    await user.click(screen.getByRole("button", { name: "Approve Self-Signup" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Approval rejected");
    });
    expect(invalidateRoster).not.toHaveBeenCalled();
  });
});

describe("AccountEditForm account timestamps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the station-local creation and last-modified timestamps", () => {
    setup({
      account: makeAccount({
        createdAt: "2024-06-15T19:04:05.000Z",
        updatedAt: "2024-07-02T13:30:00.000Z",
      }),
    });

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Jun 15, 2024, 3:04 PM EDT")).toBeInTheDocument();
    expect(screen.getByText("Last modified")).toBeInTheDocument();
    expect(screen.getByText("Jul 2, 2024, 9:30 AM EDT")).toBeInTheDocument();
  });

  // An account row that predates the column, or a truncated payload, must read
  // as "unknown" rather than as a plausible-looking wrong date.
  it("renders an unknown placeholder when a timestamp is missing", () => {
    setup({ account: makeAccount({ createdAt: null, updatedAt: null }) });

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
  });
});
