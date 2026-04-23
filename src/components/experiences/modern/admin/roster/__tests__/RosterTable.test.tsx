import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, createTestUser } from "@/lib/test-utils";
import { Authorization } from "@/lib/features/admin/types";
import { adminSlice } from "@/lib/features/admin/frontend";
import { makeStore } from "@/lib/store";

const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockAddMember = vi.fn();
const mockGetFullOrganization = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      createUser: (...args: unknown[]) => mockCreateUser(...args),
      listUsers: vi.fn().mockResolvedValue({ data: { users: [], total: 0 } }),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
    organization: {
      getFullOrganization: (...args: unknown[]) => mockGetFullOrganization(...args),
      addMember: (...args: unknown[]) => mockAddMember(...args),
      listMembers: vi.fn().mockResolvedValue({ data: { members: [] } }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/src/hooks/adminHooks", () => ({
  useAccountListResults: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

import { toast } from "sonner";
import RosterTable from "../RosterTable";

const stationManager = createTestUser({
  username: "test_sm",
  authority: Authorization.SM,
});

describe("RosterTable account creation", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();

    // Default: organization resolves successfully
    mockGetFullOrganization.mockResolvedValue({
      data: { id: "test-org-id" },
    });

    // Default: createUser succeeds
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "new-user-id" } },
    });

    // Default: updateUser (email verification) succeeds
    mockUpdateUser.mockResolvedValue({ data: {} });

    // Default: refetch resolves
    mockRefetch.mockResolvedValue(undefined);

    // Set NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD for the component
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass123");
    vi.stubEnv("NEXT_PUBLIC_APP_ORGANIZATION", "test-org");
  });

  async function openFormAndSubmit(user: ReturnType<typeof renderWithProviders>["user"]) {
    // Open the new account form
    store.dispatch(adminSlice.actions.setAdding(true));

    // Wait for the form to render
    const nameInput = await screen.findByPlaceholderText("Name");
    const usernameInput = screen.getByPlaceholderText("Username");
    const emailInput = screen.getByPlaceholderText("Email");
    const saveButton = screen.getByRole("button", { name: /save/i });

    await user.type(nameInput, "Juana Molina");
    await user.type(usernameInput, "jmolina");
    await user.type(emailInput, "jmolina@wxyc.org");
    await user.click(saveButton);
  }

  it("should show error toast when addMember fails", async () => {
    mockAddMember.mockResolvedValue({
      error: { message: "User could not be added to organization" },
    });

    const { user } = renderWithProviders(<RosterTable user={stationManager} />, { store });
    await openFormAndSubmit(user);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should show success toast when addMember succeeds", async () => {
    mockAddMember.mockResolvedValue({ data: { id: "member-id" } });

    const { user } = renderWithProviders(<RosterTable user={stationManager} />, { store });
    await openFormAndSubmit(user);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("jmolina")
      );
    });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it("should show error toast when organization ID is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORGANIZATION", "");
    mockGetFullOrganization.mockResolvedValue({ data: null });

    const { user } = renderWithProviders(<RosterTable user={stationManager} />, { store });
    await openFormAndSubmit(user);

    await waitFor(() => {
      // Without an organization, addMember is skipped — but the user is created
      // without org membership, which means role management won't work.
      // The current behavior shows success, but this should be an error.
      expect(toast.error).toHaveBeenCalled();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
