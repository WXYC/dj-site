import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import {
  AuthorizedView,
  RequireDJ,
  RequireMD,
  RequireSM,
} from "@/src/components/shared/Authorization/AuthorizedView";

// Mock the auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

// getAppOrganizationIdClient defaults to undefined — this is the real
// production shape: NEXT_PUBLIC_APP_ORGANIZATION is absent from the prod
// build env, so authority must resolve via the JWT with no organizationId.
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

// The realistic production session shape: better-auth's admin-plugin role
// column is null for ordinary members (musicDirector/dj/stationManager never
// appear there — see organization-utils tests). The WXYC tier only ever
// reaches this component via the org-role fetch, which the JWT backs.
function createMockSession(userId = "user-123", sessionRole: string | null = null) {
  return {
    data: {
      user: {
        id: userId,
        email: `${userId}@wxyc.org`,
        name: "Test User",
        username: userId,
        role: sessionRole,
        emailVerified: true,
      },
      session: { id: `sess-${userId}`, userId, expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgId.mockReturnValue(undefined);
});

describe("AuthorizedView", () => {
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
      expect(mockFetchOrgRole).not.toHaveBeenCalled();
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

  describe("when the WXYC tier resolves to an insufficient role", () => {
    it("should render fallback for a DJ trying to access SM content", async () => {
      mockUseSession.mockReturnValue(createMockSession());
      mockFetchOrgRole.mockResolvedValue("dj");

      render(
        <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
          <div>SM only content</div>
        </AuthorizedView>
      );

      expect(await screen.findByText("Access denied")).toBeInTheDocument();
      expect(screen.queryByText("SM only content")).not.toBeInTheDocument();
    });
  });

  describe("when the WXYC tier resolves to a sufficient role", () => {
    it("should render children for exact role match", async () => {
      mockUseSession.mockReturnValue(createMockSession());
      mockFetchOrgRole.mockResolvedValue("stationManager");

      render(
        <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
          <div>SM content</div>
        </AuthorizedView>
      );

      expect(await screen.findByText("SM content")).toBeInTheDocument();
      expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    });

    it("should render children when user has a higher role", async () => {
      mockUseSession.mockReturnValue(createMockSession());
      mockFetchOrgRole.mockResolvedValue("admin");

      render(
        <AuthorizedView requiredRole={Authorization.DJ} fallback={<div>Access denied</div>}>
          <div>DJ content</div>
        </AuthorizedView>
      );

      expect(await screen.findByText("DJ content")).toBeInTheDocument();
    });
  });

  describe("production session shape: session.user.role is null, tier is org-scoped", () => {
    it("resolves a real Music Director to Authorization.MD via the JWT-backed org role, with no organizationId configured", async () => {
      // This is the shape that previously broke RequireMD in production:
      // NEXT_PUBLIC_APP_ORGANIZATION unset (mockGetOrgId -> undefined) and
      // session.user.role null (better-auth admin-plugin column, never the
      // WXYC tier). Only a fix that resolves via fetchOrganizationRoleForUserClient
      // unconditionally can grant MD here.
      mockUseSession.mockReturnValue(createMockSession("md-user", null));
      mockFetchOrgRole.mockResolvedValue("musicDirector");

      render(
        <RequireMD fallback={<div>Access denied</div>}>
          <div>MD-gated content</div>
        </RequireMD>
      );

      expect(await screen.findByText("MD-gated content")).toBeInTheDocument();
      expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
      expect(mockFetchOrgRole).toHaveBeenCalledWith("md-user", undefined);
    });
  });

});

describe("Convenience Components", () => {
  it("RequireDJ renders for DJ users", async () => {
    mockUseSession.mockReturnValue(createMockSession());
    mockFetchOrgRole.mockResolvedValue("dj");

    render(
      <RequireDJ fallback={<div>No access</div>}>
        <div>DJ content</div>
      </RequireDJ>
    );

    expect(await screen.findByText("DJ content")).toBeInTheDocument();
  });

  it("RequireMD renders for Music Director users", async () => {
    mockUseSession.mockReturnValue(createMockSession());
    mockFetchOrgRole.mockResolvedValue("musicDirector");

    render(
      <RequireMD fallback={<div>No access</div>}>
        <div>MD content</div>
      </RequireMD>
    );

    expect(await screen.findByText("MD content")).toBeInTheDocument();
  });

  it("RequireSM renders for Station Manager users", async () => {
    mockUseSession.mockReturnValue(createMockSession());
    mockFetchOrgRole.mockResolvedValue("stationManager");

    render(
      <RequireSM fallback={<div>No access</div>}>
        <div>SM content</div>
      </RequireSM>
    );

    expect(await screen.findByText("SM content")).toBeInTheDocument();
  });

  it("RequireSM renders for Admin users (admin maps to SM)", async () => {
    mockUseSession.mockReturnValue(createMockSession());
    mockFetchOrgRole.mockResolvedValue("admin");

    render(
      <RequireSM fallback={<div>No access</div>}>
        <div>Admin content</div>
      </RequireSM>
    );

    expect(await screen.findByText("Admin content")).toBeInTheDocument();
  });
});

describe("when an organization is configured", () => {
  beforeEach(() => {
    mockGetOrgId.mockReturnValue("wxyc-org-123");
  });

  it("gates on the org-scoped role, not the raw session role, when they disagree", async () => {
    // Raw session role would map to SM, but the org-scoped role is only DJ —
    // the server-side check would deny SM content, so this must too.
    mockUseSession.mockReturnValue(createMockSession("user-123", "stationManager"));
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
    mockUseSession.mockReturnValue(createMockSession("user-123", "dj"));
    mockFetchOrgRole.mockResolvedValue("stationManager");

    render(
      <AuthorizedView requiredRole={Authorization.SM} fallback={<div>Access denied</div>}>
        <div>SM only content</div>
      </AuthorizedView>
    );

    expect(await screen.findByText("SM only content")).toBeInTheDocument();
  });

  it("fails closed to NO when org resolution returns undefined (not a member)", async () => {
    mockUseSession.mockReturnValue(createMockSession("user-123", "stationManager"));
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
    mockUseSession.mockReturnValue(createMockSession("user-123", "stationManager"));
    mockFetchOrgRole.mockRejectedValue(new Error("org service down"));

    render(
      <AuthorizedView requiredRole={Authorization.DJ} fallback={<div>Access denied</div>}>
        <div>DJ content</div>
      </AuthorizedView>
    );

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
  });

  it("shows the loading state while the org role is still resolving", async () => {
    mockUseSession.mockReturnValue(createMockSession("user-123", "stationManager"));
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
