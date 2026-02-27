import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { AuthorizedView, RequireDJ, RequireMD, RequireSM } from "./AuthorizedView";

// Mock the auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

import { authClient } from "@/lib/features/authentication/client";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;

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

});
