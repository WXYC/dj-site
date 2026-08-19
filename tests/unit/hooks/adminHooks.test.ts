import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { MOCK_USERS } from "@/tests/fixtures/fixtures";
import { adminSlice } from "@/lib/features/admin/frontend";
import {
  ROSTER_FETCH_CHUNK_SIZE,
  ROSTER_MEMBER_CHUNK_SIZE,
  ROSTER_PAGE_SIZE,
} from "@/lib/features/admin/types";

// Mock the auth client before importing the hook
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      listUsers: vi.fn(),
    },
    organization: {
      listMembers: vi.fn(),
    },
  },
}));

// Mock the organization-utils module for resolveOrganizationIdAdmin
const mockResolveOrganizationIdAdmin = vi.fn();
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  resolveOrganizationIdAdmin: (...args: unknown[]) => mockResolveOrganizationIdAdmin(...args),
}));

import { authClient } from "@/lib/features/authentication/client";
import { useAccountListResults } from "@/src/hooks/adminHooks";
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

function createWrapper(store?: AppStore) {
  const s = store ?? makeStore();
  return {
    store: s,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store: s, children }),
  };
}

function mockListUsersResponse(users: unknown[], total = users.length) {
  return {
    data: { users, total },
    error: null,
  };
}

function mockListMembersResponse(members: { userId: string; role: string }[]) {
  return {
    data: { members, total: members.length },
    error: null,
  };
}

const ORG_SLUG = "wxyc";
const ORG_ID = "org-uuid-123";

describe("useAccountListResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;
    mockResolveOrganizationIdAdmin.mockResolvedValue(ORG_ID);
    vi.mocked(authClient.organization.listMembers).mockResolvedValue(
      mockListMembersResponse([])
    );
  });

  it("extracts users from a parsed SDK response", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1), betterAuthUser(MOCK_USERS.stationManager)];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));
    vi.mocked(authClient.organization.listMembers).mockResolvedValue(
      mockListMembersResponse([
        { userId: MOCK_USERS.dj1.id, role: "dj" },
        { userId: MOCK_USERS.stationManager.id, role: "stationManager" },
      ])
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.accounts).toHaveLength(2);
    // Ordered by real name: "Test DJ 1" before "Test Station Manager".
    expect(result.current.accounts[0].email).toBe(MOCK_USERS.dj1.email);
    expect(result.current.accounts[0].authorization).toBe(Authorization.DJ);
    expect(result.current.accounts[1].authorization).toBe(Authorization.SM);
  });

  it("parses a stringified SDK response (better-auth parser fallback)", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1)];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: JSON.stringify({ users, total: 1 }),
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0].email).toBe(MOCK_USERS.dj1.email);
  });

  it("excludes anonymous users server-side and sorts so offsets are stable", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { wrapper } = createWrapper();
    renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(authClient.admin.listUsers).toHaveBeenCalled());
    const query = vi.mocked(authClient.admin.listUsers).mock.calls[0][0].query;
    expect(query).toMatchObject({
      limit: ROSTER_FETCH_CHUNK_SIZE,
      offset: 0,
      sortBy: "id",
      sortDirection: "asc",
      filterField: "isAnonymous",
      filterValue: "false",
      filterOperator: "eq",
    });
    // `admin/list-users` can search one of `email | name` only, so the roster
    // never asks it to: search runs over every column client-side instead.
    expect(query).not.toHaveProperty("searchValue");
    expect(query).not.toHaveProperty("searchField");
  });

  it("keeps requesting until it holds every account the server counts", async () => {
    const first = [betterAuthUser(MOCK_USERS.dj1), betterAuthUser(MOCK_USERS.dj2)];
    const second = [betterAuthUser(MOCK_USERS.stationManager)];
    vi.mocked(authClient.admin.listUsers)
      .mockResolvedValueOnce(mockListUsersResponse(first, 3))
      .mockResolvedValueOnce(mockListUsersResponse(second, 3));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalAccounts).toBe(3);
    expect(vi.mocked(authClient.admin.listUsers).mock.calls[1][0].query.offset).toBe(2);
  });

  // A roster that stops short but renders as complete hides the missing DJ.
  //
  // `list-users` answers a query that threw with 200 `{users: [], total: 0}`,
  // so the count a mid-walk failure reports contradicts the one that opened
  // the walk. Both shapes have to reach the same refusal.
  it.each([
    ["the count it opened with", 9],
    ["the zeroed count a swallowed query error reports", 0],
  ])("errors rather than rendering a truncated roster, given %s", async (_label, laterTotal) => {
    vi.mocked(authClient.admin.listUsers)
      .mockResolvedValueOnce(mockListUsersResponse([betterAuthUser(MOCK_USERS.dj1)], 9))
      .mockResolvedValueOnce(mockListUsersResponse([], laterTotal));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toContain("incomplete");
    expect(result.current.accounts).toHaveLength(0);
  });

  it("sets error state when the SDK returns an error", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

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
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.accounts).toHaveLength(0);
  });

  it("merges org member roles when resolveOrganizationIdAdmin returns an ID", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1, { role: "user" })];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));
    vi.mocked(authClient.organization.listMembers).mockResolvedValue(
      mockListMembersResponse([{ userId: MOCK_USERS.dj1.id, role: "musicDirector" }])
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts[0].authorization).toBe(Authorization.MD);
    expect(authClient.organization.listMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ organizationId: ORG_ID }),
      })
    );
  });

  it("resolves the organization with the slug the page supplies", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { wrapper } = createWrapper();
    renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(mockResolveOrganizationIdAdmin).toHaveBeenCalled());
    expect(mockResolveOrganizationIdAdmin).toHaveBeenCalledWith(ORG_SLUG);
  });

  it("prefers the membership role over the better-auth user role", async () => {
    // provisionUser mirrors only stationManager into user.role, so a DJ or
    // music director reads as "user" there. The membership is the real answer.
    const users = [
      betterAuthUser(MOCK_USERS.dj1, { role: "user" }),
      betterAuthUser(MOCK_USERS.stationManager, { role: "admin" }),
    ];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));
    vi.mocked(authClient.organization.listMembers).mockResolvedValue(
      mockListMembersResponse([
        { userId: MOCK_USERS.dj1.id, role: "dj" },
        { userId: MOCK_USERS.stationManager.id, role: "member" },
      ])
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts[0].authorization).toBe(Authorization.DJ);
    expect(result.current.accounts[1].authorization).toBe(Authorization.NO);
  });

  it("parses a stringified list-members response (better-auth parser fallback)", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1, { role: "user" })];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));
    vi.mocked(authClient.organization.listMembers).mockResolvedValue({
      data: JSON.stringify({
        members: [{ userId: MOCK_USERS.dj1.id, role: "dj" }],
        total: 1,
      }),
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.accounts[0].authorization).toBe(Authorization.DJ);
  });

  it("errors instead of guessing roles when the organization cannot be resolved", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1, { role: "user" })];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));
    mockResolveOrganizationIdAdmin.mockResolvedValue(null);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.accounts).toHaveLength(0);
    expect(authClient.organization.listMembers).not.toHaveBeenCalled();
  });

  it("errors instead of guessing roles when the membership fetch fails", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1, { role: "user" })];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));
    vi.mocked(authClient.organization.listMembers).mockResolvedValue({
      data: null,
      error: { message: "Forbidden", status: 403, statusText: "Forbidden" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toContain("Forbidden");
    expect(result.current.accounts).toHaveLength(0);
  });

  it("errors when the roster page names no organization", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(""), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(mockResolveOrganizationIdAdmin).not.toHaveBeenCalled();
    expect(authClient.admin.listUsers).not.toHaveBeenCalled();
  });

  it("requests memberships for exactly the users it fetched", async () => {
    const users = [
      betterAuthUser(MOCK_USERS.dj1),
      betterAuthUser(MOCK_USERS.stationManager),
    ];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));

    const { wrapper } = createWrapper();
    renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(authClient.organization.listMembers).toHaveBeenCalled());
    const [options] = vi.mocked(authClient.organization.listMembers).mock.calls[0];
    expect(options?.query).toMatchObject({
      organizationId: ORG_ID,
      filterField: "userId",
      filterOperator: "in",
      filterValue: [MOCK_USERS.dj1.id, MOCK_USERS.stationManager.id],
      limit: 2,
    });
  });

  it("filters by equality for a single-user page", async () => {
    // A one-element array serializes to a single query param, which the server
    // reads back as a scalar and rejects under `in`.
    const users = [betterAuthUser(MOCK_USERS.dj1)];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));

    const { wrapper } = createWrapper();
    renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(authClient.organization.listMembers).toHaveBeenCalled());
    const [options] = vi.mocked(authClient.organization.listMembers).mock.calls[0];
    expect(options?.query).toMatchObject({
      filterOperator: "eq",
      filterValue: MOCK_USERS.dj1.id,
      limit: 1,
    });
  });

  it("skips the membership fetch when the roster is empty", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse([]));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(authClient.organization.listMembers).not.toHaveBeenCalled();
  });

  // The ids ride in the query string, so they cannot all go in one request.
  it("chunks the membership fetch so the query string stays bounded", async () => {
    const many = Array.from({ length: ROSTER_MEMBER_CHUNK_SIZE + 1 }, (_, i) =>
      betterAuthUser(MOCK_USERS.dj1, {
        id: `bulk-${i}`,
        username: `bulk_${i}`,
        email: `bulk_${i}@wxyc.org`,
        realName: `Bulk DJ ${i}`,
      })
    );
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(many));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authClient.organization.listMembers).toHaveBeenCalledTimes(2);
    const [firstCall] = vi.mocked(authClient.organization.listMembers).mock.calls[0];
    const [secondCall] = vi.mocked(authClient.organization.listMembers).mock.calls[1];
    expect(firstCall?.query?.filterValue).toHaveLength(ROSTER_MEMBER_CHUNK_SIZE);
    expect(secondCall?.query).toMatchObject({
      filterOperator: "eq",
      filterValue: `bulk-${ROSTER_MEMBER_CHUNK_SIZE}`,
    });
  });

  // A roster refetch runs after every account edit, so serializing the chunks
  // would put one round trip per 50 accounts in front of the table each time.
  it("issues the membership chunks together rather than one round trip at a time", async () => {
    const many = Array.from({ length: ROSTER_MEMBER_CHUNK_SIZE + 1 }, (_, i) =>
      betterAuthUser(MOCK_USERS.dj1, {
        id: `bulk-${i}`,
        username: `bulk_${i}`,
        email: `bulk_${i}@wxyc.org`,
      })
    );
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(many));

    let releaseFirstChunk = () => {};
    const firstChunkInFlight = new Promise<void>((resolve) => {
      releaseFirstChunk = resolve;
    });
    vi.mocked(authClient.organization.listMembers)
      .mockImplementationOnce(async () => {
        await firstChunkInFlight;
        return mockListMembersResponse([]);
      })
      .mockImplementation(async () => mockListMembersResponse([]));

    const { wrapper } = createWrapper();
    renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });

    // Times out if the second chunk waits on the first, which is still pending.
    await waitFor(() =>
      expect(authClient.organization.listMembers).toHaveBeenCalledTimes(2)
    );
    releaseFirstChunk();
  });
});

describe("useAccountListResults filtering", () => {
  const roster = [
    betterAuthUser(MOCK_USERS.dj1, { realName: "Juana Molina", username: "jmolina", djName: "DJ Paradoja", email: "juana@wxyc.org" }),
    betterAuthUser(MOCK_USERS.musicDirector, { realName: "Nilüfer Yanya", username: "nyanya", djName: undefined, email: "nilufer@wxyc.org" }),
    betterAuthUser(MOCK_USERS.stationManager, { realName: "Jessica Pratt", username: "jpratt", djName: "On Your Own", email: "jessica@wxyc.org" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrganizationIdAdmin.mockResolvedValue(ORG_ID);
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(roster));
    vi.mocked(authClient.organization.listMembers).mockResolvedValue(
      mockListMembersResponse([
        { userId: MOCK_USERS.dj1.id, role: "dj" },
        { userId: MOCK_USERS.musicDirector.id, role: "musicDirector" },
        { userId: MOCK_USERS.stationManager.id, role: "stationManager" },
      ])
    );
  });

  it("searches every column the table renders, case- and diacritic-insensitively", async () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    for (const [query, expected] of [
      ["juana molina", "jmolina"],
      ["JPRATT", "jpratt"],
      ["paradoja", "jmolina"],
      ["nilufer@wxyc.org", "nyanya"],
      ["nilufer", "nyanya"],
    ] as const) {
      act(() => {
        store.dispatch(adminSlice.actions.setSearchString(query));
      });
      await waitFor(() => expect(result.current.accounts).toHaveLength(1));
      expect(result.current.accounts[0].userName).toBe(expected);
    }
  });

  it("narrows to the selected roles and restores every role when cleared", async () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      store.dispatch(adminSlice.actions.setRoleFilter([Authorization.SM]));
    });
    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
    expect(result.current.accounts[0].userName).toBe("jpratt");

    act(() => {
      store.dispatch(adminSlice.actions.setRoleFilter([]));
    });
    await waitFor(() => expect(result.current.accounts).toHaveLength(3));
  });

  it("filters without refetching the roster", async () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authClient.admin.listUsers).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(adminSlice.actions.setSearchString("juana"));
      store.dispatch(adminSlice.actions.setRoleFilter([Authorization.DJ]));
    });

    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
    expect(authClient.admin.listUsers).toHaveBeenCalledTimes(1);
  });

  it("reports the unfiltered roster size alongside the matches", async () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      store.dispatch(adminSlice.actions.setSearchString("juana"));
    });

    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(result.current.totalAccounts).toBe(3);
  });

  it("clamps a page the filtered roster no longer has", async () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountListResults(ORG_SLUG), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalPages).toBe(Math.ceil(3 / ROSTER_PAGE_SIZE));

    act(() => {
      store.dispatch(adminSlice.actions.setPage(7));
    });

    await waitFor(() => expect(result.current.page).toBe(0));
    expect(result.current.accounts).toHaveLength(3);
  });
});
