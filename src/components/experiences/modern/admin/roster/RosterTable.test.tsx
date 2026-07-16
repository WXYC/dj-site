import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MOCK_USERS, renderWithProviders } from "@/tests/helpers";
import { makeStore } from "@/lib/store";
import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";
import type { User } from "@/lib/features/authentication/types";
import RosterTable from "./RosterTable";

const mockRefetch = vi.fn();
vi.mock("@/src/hooks/adminHooks", () => ({
  useAccountListResults: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

vi.mock("@/lib/features/authentication/client", () => ({
  authBaseURL: "http://auth.test",
  authClient: {},
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const adminUser = {
  username: MOCK_USERS.stationManager.username,
  email: MOCK_USERS.stationManager.email,
  authority: Authorization.SM,
} as User;

describe("RosterTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ emailSent: true }),
      }))
    );
  });

  // #638: a successful add must not reset the whole admin slice — the DJ's
  // active search filter and page position have to survive.
  it("preserves the search filter and page after a successful add", async () => {
    const store = makeStore();
    // Order matters: setSearchString resets page to 0, so page is set after.
    store.dispatch(adminSlice.actions.setSearchString("Test DJ"));
    store.dispatch(adminSlice.actions.setPage(2));
    store.dispatch(adminSlice.actions.setAdding(true));

    const { user } = renderWithProviders(
      <RosterTable user={adminUser} organizationSlug="wxyc" />,
      { store }
    );

    await user.type(
      screen.getByPlaceholderText("Name"),
      MOCK_USERS.dj1.realName
    );
    await user.type(
      screen.getByPlaceholderText("Username"),
      MOCK_USERS.dj1.username
    );
    await user.type(
      screen.getByPlaceholderText("Email"),
      MOCK_USERS.dj1.email
    );

    await user.click(screen.getByRole("button", { name: /Save/i }));

    // The add form closes on success…
    await waitFor(() =>
      expect(adminSlice.selectors.getAdding(store.getState())).toBe(false)
    );

    // …but the search + page context is untouched.
    expect(adminSlice.selectors.getSearchString(store.getState())).toBe(
      "Test DJ"
    );
    expect(adminSlice.selectors.getPage(store.getState())).toBe(2);
  });
});
