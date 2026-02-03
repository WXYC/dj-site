import { vi } from "vitest";

/**
 * Creates mock for useRegistry hook.
 *
 * NOTE: Due to vi.mock hoisting, factory functions cannot be called directly
 * inside vi.mock(). Use the returned values directly in the mock factory,
 * or call these functions in beforeEach to configure mock behavior.
 *
 * @example
 * // Option 1: Inline the mock values in vi.mock()
 * vi.mock("@/src/hooks/authenticationHooks", () => ({
 *   useRegistry: vi.fn(() => ({ loading: false, info: { id: 1, djName: "Test DJ" } })),
 * }));
 *
 * // Option 2: Use in beforeEach for dynamic configuration
 * let registryMock = createRegistryMock();
 * beforeEach(() => {
 *   vi.mocked(useRegistry).mockReturnValue(registryMock.hookReturn);
 * });
 */
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

/**
 * Creates mock for sonner toast.
 *
 * @example
 * vi.mock("sonner", () => createToastMock());
 */
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

/**
 * Creates mock for authClient (Better Auth).
 *
 * @example
 * vi.mock("@/lib/features/authentication/client", () => ({
 *   authClient: createAuthClientMock(),
 * }));
 */
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
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        realName: "Real Name",
        djName: "DJ Test",
        role: "member",
      },
      {
        id: "user-2",
        name: "Admin User",
        email: "admin@example.com",
        realName: "Admin Real",
        djName: "DJ Admin",
        role: "admin",
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
