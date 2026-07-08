import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import OnboardingInviteSessionGuard from "./OnboardingInviteSessionGuard";

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

describe("OnboardingInviteSessionGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: null });
    mockSignOut.mockResolvedValue(undefined);
  });

  it("renders children when no session is active", async () => {
    render(
      <OnboardingInviteSessionGuard inviteToken="invite-token">
        <div>Onboarding form</div>
      </OnboardingInviteSessionGuard>
    );

    expect(await screen.findByText("Onboarding form")).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("signs out an existing session before showing the invite form", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "admin-1" } } });

    render(
      <OnboardingInviteSessionGuard inviteToken="invite-token">
        <div>Onboarding form</div>
      </OnboardingInviteSessionGuard>
    );

    await waitFor(() => {
      expect(mockClearTokenCache).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.getByText("Onboarding form")).toBeInTheDocument();
    });
  });
});
