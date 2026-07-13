import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuthLinkSessionGuard from "./AuthLinkSessionGuard";

const mockRefresh = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockClearTokenCache = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
  clearTokenCache: (...args: unknown[]) => mockClearTokenCache(...args),
}));

describe("AuthLinkSessionGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: null });
    mockSignOut.mockResolvedValue({});
  });

  it("renders children when no session is active", async () => {
    render(
      <AuthLinkSessionGuard linkToken="reset-token">
        <div>Reset form</div>
      </AuthLinkSessionGuard>
    );

    expect(await screen.findByText("Reset form")).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("signs out an existing session before showing the linked form", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "other-user" } } });
    mockSignOut.mockResolvedValue({ data: {}, error: null });

    render(
      <AuthLinkSessionGuard linkToken="reset-token">
        <div>Reset form</div>
      </AuthLinkSessionGuard>
    );

    await waitFor(() => {
      expect(mockClearTokenCache).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.getByText("Reset form")).toBeInTheDocument();
    });
  });

  it("does not render the linked form when sign-out fails", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "other-user" } } });
    mockSignOut.mockResolvedValue({ error: { message: "sign-out failed" } });

    render(
      <AuthLinkSessionGuard linkToken="reset-token">
        <div>Reset form</div>
      </AuthLinkSessionGuard>
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(screen.queryByText("Reset form")).not.toBeInTheDocument();
    expect(screen.getByText("Preparing…")).toBeInTheDocument();
  });

  it("shows a custom loading message while preparing", () => {
    render(
      <AuthLinkSessionGuard
        linkToken="reset-token"
        loadingMessage="Preparing password reset…"
      >
        <div>Reset form</div>
      </AuthLinkSessionGuard>
    );

    expect(screen.getByText("Preparing password reset…")).toBeInTheDocument();
  });
});
