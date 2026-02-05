import { vi } from "vitest";
import { MOCK_USERS } from "../fixtures";

/** Creates mock for useRegistry hook. */
export function createRegistryMock(options: {
  loading?: boolean;
  djId?: number;
  djName?: string;
} = {}) {
  const { loading = false, djId = 1, djName = "Test DJ" } = options;

  return {
    hookReturn: {
      loading,
      info: loading ? null : { id: djId, djName },
    },
  };
}

/** Creates mock for sonner toast. */
export function createToastMock() {
  return {
    toast: {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      loading: vi.fn(),
      dismiss: vi.fn(),
    },
  };
}

/** Creates mock for authClient (Better Auth). */
export function createAuthClientMock(options: {
  users?: Array<{
    id: string;
    name: string;
    email: string;
    realName?: string;
    djName?: string;
    role?: string;
  }>;
} = {}) {
  const {
    users = [
      {
        id: MOCK_USERS.member.id,
        name: MOCK_USERS.member.username,
        email: MOCK_USERS.member.email,
        realName: MOCK_USERS.member.realName,
        djName: MOCK_USERS.member.djName,
        role: MOCK_USERS.member.role,
      },
      {
        id: MOCK_USERS.stationManager.id,
        name: MOCK_USERS.stationManager.username,
        email: MOCK_USERS.stationManager.email,
        realName: MOCK_USERS.stationManager.realName,
        djName: MOCK_USERS.stationManager.djName,
        role: MOCK_USERS.stationManager.role,
      },
    ],
  } = options;

  return {
    admin: {
      listUsers: vi.fn(() =>
        Promise.resolve({
          data: { users },
          error: null,
        })
      ),
    },
    organization: {
      getFullOrganization: vi.fn(() =>
        Promise.resolve({
          data: { id: "org-1" },
        })
      ),
      listMembers: vi.fn(() =>
        Promise.resolve({
          data: {
            members: users.map((u) => ({ userId: u.id, role: u.role })),
          },
          error: null,
        })
      ),
    },
  };
}
