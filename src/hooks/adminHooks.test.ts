import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { MOCK_USERS } from "@/lib/test-utils/fixtures";
import { adminSlice } from "@/lib/features/admin/frontend";
import { ROSTER_PAGE_SIZE } from "@/lib/features/admin/types";

// Mock the auth client before importing the hook
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      listUsers: vi.fn(),
    },
    organization: {
      getFullOrganization: vi.fn(),
      listMembers: vi.fn(),
    },
  },
}));

import { authClient } from "@/lib/features/authentication/client";
import { useAccountListResults } from "./adminHooks";
import { Authorization } from "@/lib/features/admin/types";

/** Build a better-auth user object from MOCK_USERS fixture data */
function betterAuthUser(mockUser: (typeof MOCK_USERS)[keyof typeof MOCK_USERS], overrides?: Record<string, unknown>) {
  return {
    id: mockUser.id,
    name: mockUser.realName,
    email: mockUser.email,
    username: mockUser.username,
    role: mockUser.role,
    emailVerified: true,
    realName: mockUser.realName,
    djName: "djName" in mockUser ? mockUser.djName : undefined,
    isAnonymous: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    banned: false,
    banReason: null,
    banExpires: null,
    displayUsername: null,
    image: null,
    appSkin: "modern-light",
    capabilities: [],
    ...overrides,
  };
}

const ANONYMOUS_USER = {
  id: "anon-1",
  name: "Anonymous",
  email: "temp-abc123@anonymous.wxyc.org",
  username: null,
  role: "user",
  emailVerified: false,
  realName: null,
  djName: null,
  isAnonymous: true,
  createdAt: "2026-03-30T00:00:00.000Z",
  updatedAt: "2026-03-30T00:00:00.000Z",
  banned: false,
  banReason: null,
  banExpires: null,
  displayUsername: null,
  image: null,
  appSkin: "modern-light",
  capabilities: [],
};

function createWrapper(store?: AppStore) {
  const s = store ?? makeStore();
  return {
    store: s,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store: s, children }),
  };
}

function mockListUsersResponse(users: unknown[]) {
  return {
    data: { users, total: users.length },
    error: null,
  };
}

describe("useAccountListResults", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts users from a parsed SDK response", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1), betterAuthUser(MOCK_USERS.stationManager)];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0].email).toBe(MOCK_USERS.dj1.email);
    expect(result.current.data[0].authorization).toBe(Authorization.DJ);
    expect(result.current.data[1].authorization).toBe(Authorization.SM);
  });

  it("parses a stringified SDK response (better-auth parser fallback)", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1)];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: JSON.stringify({ users, total: 1 }),
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].email).toBe(MOCK_USERS.dj1.email);
  });

  it("passes server-side filter and pagination params to listUsers", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { wrapper } = createWrapper();
    renderHook(() => useAccountListResults(), { wrapper });

    await waitFor(() => expect(authClient.admin.listUsers).toHaveBeenCalled());
    const query = vi.mocked(authClient.admin.listUsers).mock.calls[0][0].query;
    expect(query).toMatchObject({
      limit: ROSTER_PAGE_SIZE,
      offset: 0,
      filterField: "isAnonymous",
      filterValue: "false",
      filterOperator: "eq",
    });
    // No search params when searchString is empty
    expect(query).not.toHaveProperty("searchValue");
  });

  it("passes search params when searchString is set", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { store, wrapper } = createWrapper();
    renderHook(() => useAccountListResults(), { wrapper });

    // Wait for initial fetch
    await waitFor(() => expect(authClient.admin.listUsers).toHaveBeenCalledTimes(1));

    // Dispatch search and advance debounce timer
    act(() => {
      store.dispatch(adminSlice.actions.setSearchString("Juana"));
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(authClient.admin.listUsers).toHaveBeenCalledTimes(2));
    const query = vi.mocked(authClient.admin.listUsers).mock.calls[1][0].query;
    expect(query).toMatchObject({
      searchValue: "Juana",
      searchField: "name",
      searchOperator: "contains",
    });
  });

  it("computes offset from page", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { store, wrapper } = createWrapper();
    renderHook(() => useAccountListResults(), { wrapper });

    await waitFor(() => expect(authClient.admin.listUsers).toHaveBeenCalledTimes(1));

    act(() => {
      store.dispatch(adminSlice.actions.setPage(2));
    });

    await waitFor(() => expect(authClient.admin.listUsers).toHaveBeenCalledTimes(2));
    const query = vi.mocked(authClient.admin.listUsers).mock.calls[1][0].query;
    expect(query.offset).toBe(2 * ROSTER_PAGE_SIZE);
  });

  it("sets error state when the SDK returns an error", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("returns empty data when SDK returns no users", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: { users: [], total: 0 },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(0);
  });
});
