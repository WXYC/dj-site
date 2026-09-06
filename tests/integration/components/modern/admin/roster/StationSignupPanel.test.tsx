import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import StationSignupPanel from "@/src/components/experiences/modern/admin/roster/StationSignupPanel";
import type { StationSignupStatus } from "@/lib/features/station-signup/types";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  authFetch: vi.fn(),
}));

vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

import { authClient, authFetch } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import { toast } from "sonner";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;
const mockAuthFetch = authFetch as ReturnType<typeof vi.fn>;

function sessionWithRole() {
  return {
    data: {
      user: {
        id: "manager-1",
        email: "manager@wxyc.org",
        name: "Station Manager",
        username: "manager",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "manager-1", expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  };
}

function baseStatus(overrides: Partial<StationSignupStatus> = {}): StationSignupStatus {
  return {
    now: "2026-09-06T18:00:00.000Z",
    passcodes: [
      {
        id: "passcode-1",
        state: "active",
        createdAt: "2026-08-01T00:00:00.000Z",
        createdBy: "manager-1",
        expiresAt: "2026-09-15T00:00:00.000Z",
        revokedAt: null,
        revokedReason: null,
        revokedByKeyRotation: false,
        lastUsedAt: "2026-09-05T12:00:00.000Z",
        useCount: 3,
        maxUses: 25,
        exhausted: false,
      },
    ],
    cooldown: {
      inCooldown: false,
      noMatchFailureCount: 0,
      allFailureCount: 0,
      windowMinutes: 10,
      holdMinutes: 15,
      threshold: 20,
      lastClearedAt: null,
    },
    attempts: {
      since: "2026-09-05T18:00:00.000Z",
      windowHours: 24,
      countsByOutcome: {},
      recent: [],
    },
    pendingReview: [],
    ...overrides,
  };
}

/** Routes `authFetch` calls by path, keyed the same way `stationSignupAdminRequest` builds them. */
function mockStationSignupRoutes(routes: Record<string, { status: number; data: unknown }>) {
  mockAuthFetch.mockImplementation(async (path: string) => {
    const route = routes[path];
    if (!route) throw new Error(`Unexpected authFetch call: ${path}`);
    return { ok: route.status >= 200 && route.status < 300, status: route.status, data: route.data };
  });
}

describe("StationSignupPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      mockStationSignupRoutes({ "/admin/station-signup/status": { status: 200, data: baseStatus() } });

      renderWithProviders(<StationSignupPanel />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByTestId("station-signup-panel")).not.toBeInTheDocument()
      );
    });

    it("renders the panel for a station manager", async () => {
      mockFetchOrgRole.mockResolvedValue("stationManager");
      mockUseSession.mockReturnValue(sessionWithRole());
      mockStationSignupRoutes({ "/admin/station-signup/status": { status: 200, data: baseStatus() } });

      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByTestId("station-signup-panel")).toBeInTheDocument();
    });
  });

  describe("as a station manager", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("stationManager");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("lists passcode state without ever showing plaintext", async () => {
      mockStationSignupRoutes({ "/admin/station-signup/status": { status: 200, data: baseStatus() } });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText("Active")).toBeInTheDocument();
      expect(screen.getByText("3 / 25")).toBeInTheDocument();
      expect(screen.queryByText(/^\d{4,}$/)).not.toBeInTheDocument();
    });

    it("shows the cooldown alert and a clear-cooldown control only while in cooldown", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            cooldown: {
              inCooldown: true,
              noMatchFailureCount: 25,
              allFailureCount: 30,
              windowMinutes: 10,
              holdMinutes: 15,
              threshold: 20,
              lastClearedAt: null,
            },
          }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/Signup is in cooldown/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Clear cooldown/i })).toBeInTheDocument();
    });

    it("does not show a clear-cooldown control when not in cooldown", async () => {
      mockStationSignupRoutes({ "/admin/station-signup/status": { status: 200, data: baseStatus() } });
      renderWithProviders(<StationSignupPanel />);

      await screen.findByTestId("station-signup-panel");
      expect(screen.queryByRole("button", { name: /Clear cooldown/i })).not.toBeInTheDocument();
    });

    it("reveals the plaintext code only after an explicit confirmation, and never before", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/reveal": {
          status: 200,
          data: { passcodes: [{ id: "passcode-1", code: "SUNFLOWER99", expiresAt: "2026-09-15T00:00:00.000Z", useCount: 3, maxUses: 25 }] },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByRole("button", { name: /^Reveal$/i })).toBeInTheDocument();
      expect(screen.queryByText("SUNFLOWER99")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^Reveal$/i }));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(/logged/i)).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: /^Reveal$/i }));

      expect(await screen.findByText("SUNFLOWER99")).toBeInTheDocument();
      expect(screen.getByText(/this reveal was logged/i)).toBeInTheDocument();
      expect(mockAuthFetch).toHaveBeenCalledWith(
        "/admin/station-signup/reveal",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("rotates the passcode and shows the new plaintext once", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/rotate": {
          status: 200,
          data: { id: "passcode-2", code: "MOONBEAM42", expiresAt: "2026-09-20T00:00:00.000Z", maxUses: 25, autoRevokedPasscodeIds: [] },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Rotate$/i }));

      expect(await screen.findByText("MOONBEAM42")).toBeInTheDocument();
      expect(mockAuthFetch).toHaveBeenCalledWith(
        "/admin/station-signup/rotate",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("surfaces the cap-exceeded 409 as a plain-language message rather than a raw error", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/rotate": {
          status: 409,
          data: { error: "Two passcodes are already active", code: "passcode_cap_exceeded" },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Rotate$/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Two station passcodes are already active. Revoke one before rotating.")
      );
    });

    it("revokes a passcode after confirmation, scoped to the row's id", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/revoke": { status: 200, data: { passcodeId: "passcode-1", revoked: true } },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /Revoke/i }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^Revoke$/i }));

      await waitFor(() =>
        expect(mockAuthFetch).toHaveBeenCalledWith(
          "/admin/station-signup/revoke",
          expect.objectContaining({ method: "POST", json: { passcodeId: "passcode-1" } })
        )
      );
    });

    it("clears the cooldown on demand", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            cooldown: {
              inCooldown: true,
              noMatchFailureCount: 25,
              allFailureCount: 25,
              windowMinutes: 10,
              holdMinutes: 15,
              threshold: 20,
              lastClearedAt: null,
            },
          }),
        },
        "/admin/station-signup/clear-cooldown": {
          status: 200,
          data: {
            cleared: true,
            cooldown: {
              inCooldown: false,
              noMatchFailureCount: 0,
              allFailureCount: 0,
              windowMinutes: 10,
              holdMinutes: 15,
              threshold: 20,
              lastClearedAt: "2026-09-06T18:00:00.000Z",
            },
          },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /Clear cooldown/i }));

      await waitFor(() =>
        expect(mockAuthFetch).toHaveBeenCalledWith(
          "/admin/station-signup/clear-cooldown",
          expect.objectContaining({ method: "POST" })
        )
      );
    });

    it("names the missing key plainly on a 503 passcode_key_unset", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 503,
          data: { error: "STATION_PASSCODE_KEY is not set", code: "passcode_key_unset" },
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/STATION_PASSCODE_KEY is not set/i)).toBeInTheDocument();
    });

    it("names rotate as the recovery on a 503 passcode_undecryptable", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 503,
          data: { error: "will not decrypt", code: "passcode_undecryptable" },
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/Rotating administratively revokes/i)).toBeInTheDocument();
    });

    it("tells a caller who lost their session to sign in again on a 401", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 401, data: { error: "Unauthorized" } },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
    });

    it("tells a signed-in non-manager they lack access on a 403", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 403,
          data: { error: "Forbidden: admin role required" },
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/do not have station manager access/i)).toBeInTheDocument();
    });
  });
});
