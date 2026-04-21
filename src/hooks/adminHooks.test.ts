import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import { MOCK_USERS } from "@/lib/test-utils/fixtures";

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

function createWrapper() {
  const store = makeStore();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store, children });
}

function mockListUsersResponse(users: unknown[]) {
  return {
    data: { users, total: users.length },
    error: null,
  };
}

describe("useAccountListResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  });

  it("extracts users from a parsed SDK response", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1), betterAuthUser(MOCK_USERS.stationManager)];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));

    const { result } = renderHook(() => useAccountListResults(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0].email).toBe(MOCK_USERS.dj1.email);
    expect(result.current.data[0].authorization).toBe(Authorization.DJ);
    expect(result.current.data[1].authorization).toBe(Authorization.SM);
  });

  it("parses a stringified SDK response (better-auth parser fallback)", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1)];
    // Simulate the bug: SDK's betterJSONParse with strict:false returns the raw JSON
    // string when JSON.parse fails internally, instead of throwing.
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: JSON.stringify({ users, total: 1 }),
      error: null,
    });

    const { result } = renderHook(() => useAccountListResults(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].email).toBe(MOCK_USERS.dj1.email);
  });

  it("filters out anonymous users", async () => {
    const users = [
      betterAuthUser(MOCK_USERS.dj1),
      ANONYMOUS_USER,
      betterAuthUser(MOCK_USERS.dj2),
      { ...ANONYMOUS_USER, id: "anon-2", email: "temp-xyz789@anonymous.wxyc.org" },
    ];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue(mockListUsersResponse(users));

    const { result } = renderHook(() => useAccountListResults(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data.every((a) => !a.email?.includes("@anonymous.wxyc.org"))).toBe(true);
  });

  it("filters out anonymous users from a stringified response", async () => {
    const users = [betterAuthUser(MOCK_USERS.dj1), ANONYMOUS_USER];
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: JSON.stringify({ users, total: 2 }),
      error: null,
    });

    const { result } = renderHook(() => useAccountListResults(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].email).toBe(MOCK_USERS.dj1.email);
  });

  it("sets error state when the SDK returns an error", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" },
    });

    const { result } = renderHook(() => useAccountListResults(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("returns empty data when SDK returns no users", async () => {
    vi.mocked(authClient.admin.listUsers).mockResolvedValue({
      data: { users: [], total: 0 },
      error: null,
    });

    const { result } = renderHook(() => useAccountListResults(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(0);
  });
});
