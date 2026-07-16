import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";
import AccountEditPanel from "@/src/components/experiences/modern/Rightbar/panels/AccountEditPanel";
import {
  renderWithProviders,
  createTestStore,
  createTestAccountResult,
} from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { Account } from "@/lib/features/admin/types";

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

function openAccountEditPanel(account: Account) {
  return applicationSlice.actions.openPanel({
    type: "account-edit",
    account,
    isSelf: false,
    organizationSlug: "wxyc",
  });
}

describe("AccountEditPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reset form state when the panel switches to a different account", async () => {
    const juana = createTestAccountResult({
      id: "user-juana",
      userName: "juana",
      realName: "Juana Molina",
      djName: "DJ Juana",
    });
    const jessica = createTestAccountResult({
      id: "user-jessica",
      userName: "jessica",
      realName: "Jessica Pratt",
      djName: "DJ Jess",
    });

    const store = createTestStore();
    store.dispatch(openAccountEditPanel(juana));
    const { user } = renderWithProviders(<AccountEditPanel />, { store });

    expect(screen.getByLabelText("Real Name")).toHaveValue("Juana Molina");

    // Dirty the first account's form so stale state would be visible
    await user.type(screen.getByLabelText("Real Name"), " Edited");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    // Switch to editing a different account without closing the panel
    act(() => {
      store.dispatch(openAccountEditPanel(jessica));
    });

    expect(screen.getByLabelText("Real Name")).toHaveValue("Jessica Pratt");
    expect(screen.getByLabelText("DJ Name")).toHaveValue("DJ Jess");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
