import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { AuthorizedView, RequireDJ, RequireMD, RequireSM } from "@/src/components/shared/Authorization/AuthorizedView";

// Mock the auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

// Org resolution is mocked so the org-scoped path can be driven independently
// of env config. Defaults to "no organization configured" so the existing
// raw-role tests exercise the base-role path.
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

import { authClient } from "@/lib/features/authentication/client";
import { getAppOrganizationIdClient } from "@/lib/features/authentication/organization-config";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockGetOrgId = getAppOrganizationIdClient as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

function createMockSession(role: string) {
  return {
    data: {
      user: {
        id: "user-123",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        role,
        emailVerified: true,
      },
      session: { id: "sess-123", userId: "user-123", expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  };
}

describe("AuthorizedView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user is not authenticated", () => {
    it("should render fallback when no session", () => {
      mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
      
      render(
        <AuthorizedView requiredRole={Authorization.DJ} fallback={<div>Access denied</div>}>
          <div>Protected content</div>
        </AuthorizedView>
      );
      
      expect(screen.getByText("Access denied")).toBeInTheDocument();
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    });

    it("should render nothing when no fallback provided", () => {
      mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
      
      const { container } = render(
        <AuthorizedView requiredRole={Authorization.DJ}>
          <div>Protected content</div>
        </AuthorizedView>
      );
      
      expect(container.textContent).toBe("");
    });
  });

  describe("when session is loading", () => {
    it("should render loading state if provided", () => {
      mockUseSession.mockReturnValue({ data: null, isPending: true, error: null });
      
      render(
        <AuthorizedView 
          requiredRole={Authorization.DJ} 
          loading={<div>Loading...</div>}
        >
          <div>Protected content</div>
        </AuthorizedView>
      );
      
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("when user has insufficient role", () => {
    it("should render fallback for DJ trying to access SM content", () => {
      mockUseSession.mockReturnValue(createMockSession("dj"));
      
      render(
        <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
          <div>SM only content</div>
        </AuthorizedView>
      );
      
      expect(screen.getByText("Access denied")).toBeInTheDocument();
      expect(screen.queryByText("SM only content")).not.toBeInTheDocument();
    });
  });

  describe("when user has sufficient role", () => {
    it("should render children for exact role match", () => {
      mockUseSession.mockReturnValue(createMockSession("stationManager"));
      
      render(
        <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
          <div>SM content</div>
        </AuthorizedView>
      );
      
      expect(screen.getByText("SM content")).toBeInTheDocument();
      expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    });

    it("should render children when user has higher role", () => {
      mockUseSession.mockReturnValue(createMockSession("admin"));
      
      render(
        <AuthorizedView requiredRole={Authorization.DJ} fallback={<div>Access denied</div>}>
          <div>DJ content</div>
        </AuthorizedView>
      );
      
      expect(screen.getByText("DJ content")).toBeInTheDocument();
    });
  });
});

describe("Convenience Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RequireDJ renders for DJ users", () => {
    mockUseSession.mockReturnValue(createMockSession("dj"));
    
    render(
      <RequireDJ fallback={<div>No access</div>}>
        <div>DJ content</div>
      </RequireDJ>
    );
    
    expect(screen.getByText("DJ content")).toBeInTheDocument();
  });

  it("RequireMD renders for Music Director users", () => {
    mockUseSession.mockReturnValue(createMockSession("musicDirector"));
    
    render(
      <RequireMD fallback={<div>No access</div>}>
        <div>MD content</div>
      </RequireMD>
    );
    
    expect(screen.getByText("MD content")).toBeInTheDocument();
  });

  it("RequireSM renders for Station Manager users", () => {
    mockUseSession.mockReturnValue(createMockSession("stationManager"));
    
    render(
      <RequireSM fallback={<div>No access</div>}>
        <div>SM content</div>
      </RequireSM>
    );
    
    expect(screen.getByText("SM content")).toBeInTheDocument();
  });

  it("RequireSM renders for Admin users (admin maps to SM)", () => {
    mockUseSession.mockReturnValue(createMockSession("admin"));

    render(
      <RequireSM fallback={<div>No access</div>}>
        <div>Admin content</div>
      </RequireSM>
    );

    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });
});

describe("when an organization is configured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgId.mockReturnValue("wxyc-org-123");
  });

  it("gates on the org-scoped role, not the raw session role, when they disagree", async () => {
    // Raw session role would map to SM, but the org-scoped role is only DJ —
    // the server-side check would deny SM content, so this must too.
    mockUseSession.mockReturnValue(createMockSession("stationManager"));
    mockFetchOrgRole.mockResolvedValue("dj");

    render(
      <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
        <div>SM only content</div>
      </AuthorizedView>
    );

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("SM only content")).not.toBeInTheDocument();
    expect(mockFetchOrgRole).toHaveBeenCalledWith("user-123", "wxyc-org-123");
  });

  it("grants on the org-scoped role even when the raw session role is lower", async () => {
    mockUseSession.mockReturnValue(createMockSession("dj"));
    mockFetchOrgRole.mockResolvedValue("stationManager");

    render(
      <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
        <div>SM only content</div>
      </AuthorizedView>
    );

    expect(await screen.findByText("SM only content")).toBeInTheDocument();
  });

  it("fails closed to NO when org resolution returns undefined (not a member)", async () => {
    mockUseSession.mockReturnValue(createMockSession("stationManager"));
    mockFetchOrgRole.mockResolvedValue(undefined);

    render(
      <AuthorizedView requiredRole={Authorization.DJ} fallback={<div>Access denied</div>}>
        <div>DJ content</div>
      </AuthorizedView>
    );

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("DJ content")).not.toBeInTheDocument();
  });

  it("fails closed to NO when org resolution throws", async () => {
    mockUseSession.mockReturnValue(createMockSession("stationManager"));
    mockFetchOrgRole.mockRejectedValue(new Error("org service down"));

    render(
      <AuthorizedView requiredRole={Authorization.DJ} fallback={<div>Access denied</div>}>
        <div>DJ content</div>
      </AuthorizedView>
    );

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
  });

  it("shows the loading state while the org role is still resolving", async () => {
    mockUseSession.mockReturnValue(createMockSession("stationManager"));
    let resolveRole: (role: string) => void = () => {};
    mockFetchOrgRole.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRole = resolve;
      })
    );

    render(
      <AuthorizedView
        requiredRole={Authorization.SM}
        fallback={<div>Access denied</div>}
        loading={<div>Loading...</div>}
      >
        <div>SM content</div>
      </AuthorizedView>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("SM content")).not.toBeInTheDocument();

    resolveRole("stationManager");
    await waitFor(() => expect(screen.getByText("SM content")).toBeInTheDocument());
  });

  it("never paints the previous user's authority during a live session identity swap", async () => {
    const sessionFor = (id: string, role: string) => ({
      data: {
        user: { id, email: `${id}@wxyc.org`, name: id, username: id, role, emailVerified: true },
        session: { id: `sess-${id}`, userId: id, expiresAt: new Date() },
      },
      isPending: false,
      error: null,
    });

    mockGetOrgId.mockReturnValue("org-wxyc");
    mockUseSession.mockReturnValue(sessionFor("user-a", "dj"));
    let resolveSecond: (role: string) => void = () => {};
    mockFetchOrgRole
      .mockResolvedValueOnce("stationManager")
      .mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveSecond = resolve; })
      );

    const makeView = () => (
      <AuthorizedView
        requiredRole={Authorization.SM}
        fallback={<div>Access denied</div>}
        loading={<div>Loading...</div>}
      >
        <div>SM content</div>
      </AuthorizedView>
    );

    const { rerender } = render(makeView());
    await waitFor(() => expect(screen.getByText("SM content")).toBeInTheDocument());

    mockUseSession.mockReturnValue(sessionFor("user-b", "dj"));
    rerender(makeView());

    expect(screen.queryByText("SM content")).not.toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolveSecond("dj");
    await waitFor(() => expect(screen.getByText("Access denied")).toBeInTheDocument());
  });
});
