import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import StationSignupPanel from "@/src/components/experiences/modern/admin/roster/StationSignupPanel";
import {
  cooldownLiftsAtMs,
  formatHoldRemaining,
  useServerClockMs,
} from "@/src/components/experiences/modern/admin/roster/stationSignupStatusView";
import type {
  StationPasscodeStateRow,
  StationSignupAttemptView,
  StationSignupAttempts,
  StationSignupStatus,
} from "@/lib/features/station-signup/types";

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

function passcodeRow(overrides: Partial<StationPasscodeStateRow> = {}): StationPasscodeStateRow {
  return {
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
    ...overrides,
  };
}

function attemptRow(overrides: Partial<StationSignupAttemptView> = {}): StationSignupAttemptView {
  return {
    id: "attempt-1",
    attemptedAt: "2026-09-06T17:50:00.000Z",
    outcome: "passcode_fail",
    passcodeId: null,
    actorUserId: null,
    ipHash: "hash-1",
    ...overrides,
  };
}

function attempts(overrides: Partial<StationSignupAttempts> = {}): StationSignupAttempts {
  return {
    since: "2026-09-05T18:00:00.000Z",
    windowHours: 24,
    countsByOutcome: {},
    recent: [],
    ...overrides,
  };
}

/** The refusal state, holding for `holdMinutes` past the newest no-match failure. */
function heldCooldown(overrides: Partial<StationSignupStatus["cooldown"]> = {}): StationSignupStatus["cooldown"] {
  return {
    inCooldown: true,
    noMatchFailureCount: 25,
    allFailureCount: 30,
    windowMinutes: 10,
    holdMinutes: 15,
    threshold: 20,
    lastClearedAt: null,
    ...overrides,
  };
}

function baseStatus(overrides: Partial<StationSignupStatus> = {}): StationSignupStatus {
  return {
    now: "2026-09-06T18:00:00.000Z",
    passcodes: [passcodeRow()],
    cooldown: {
      inCooldown: false,
      noMatchFailureCount: 0,
      allFailureCount: 0,
      windowMinutes: 10,
      holdMinutes: 15,
      threshold: 20,
      lastClearedAt: null,
    },
    attempts: attempts(),
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
      // The status payload carries no plaintext at all, so the alert that is
      // the only surface for one must not be on screen.
      expect(screen.queryByText(/this reveal was logged/i)).not.toBeInTheDocument();
    });

    it("names why a passcode was revoked, not merely that it was", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            passcodes: [
              passcodeRow({
                id: "passcode-0",
                state: "revoked",
                revokedAt: "2026-09-04T15:00:00.000Z",
                revokedReason: "posted in the station group chat",
              }),
            ],
          }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText("Revoked")).toBeInTheDocument();
      expect(screen.getByText("posted in the station group chat")).toBeInTheDocument();
    });

    it("shows the date, not just the time, for last-used and expiry so a manager can tell today from next week", async () => {
      mockStationSignupRoutes({ "/admin/station-signup/status": { status: 200, data: baseStatus() } });
      renderWithProviders(<StationSignupPanel />);

      await screen.findByText("Active");
      // lastUsedAt 2026-09-05T12:00:00Z is 8:00:00 AM EDT on 9/5.
      expect(screen.getByText("9/5/2026 8:00:00 AM")).toBeInTheDocument();
      // expiresAt 2026-09-15T00:00:00Z is 8:00:00 PM EDT on 9/14.
      expect(screen.getByText("9/14/2026 8:00:00 PM")).toBeInTheDocument();
    });

    it("shows the cooldown alert and a clear-cooldown control only while in cooldown", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus({ cooldown: heldCooldown() }) },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/Signup is in cooldown/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Clear cooldown/i })).toBeInTheDocument();
    });

    it("counts down the time left on the hold, anchored on the newest failure that arms it", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            now: "2026-09-06T18:00:00.000Z",
            cooldown: heldCooldown({ holdMinutes: 15 }),
            attempts: attempts({
              countsByOutcome: { passcode_fail: 25, cooldown_refused: 5 },
              recent: [
                // Out of order, and the newest row is refusal-exempt: neither
                // may move the deadline off the 17:57:30 no-match failure,
                // which holds until 18:12:30 -- 12m 30s past the server's now.
                attemptRow({ id: "attempt-3", attemptedAt: "2026-09-06T17:59:00.000Z", outcome: "cooldown_refused" }),
                attemptRow({ id: "attempt-1", attemptedAt: "2026-09-06T17:50:00.000Z" }),
                attemptRow({ id: "attempt-2", attemptedAt: "2026-09-06T17:57:30.000Z" }),
              ],
            }),
          }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/Lifts on its own in 12m \d\ds/)).toBeInTheDocument();
    });

    it("states the hold duration instead of a countdown when no arming failure is still in the log", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({ cooldown: heldCooldown(), attempts: attempts({ countsByOutcome: { passcode_fail: 25 } }) }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText(/lifts on its own 15 minutes after the last qualifying failure/i)).toBeInTheDocument();
    });

    it("shows the window-wide attempt census, including outcomes it has no prose for", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            attempts: attempts({
              // `recent` is a capped display list; a census counted from it
              // would read zero here while the window holds 44 attempts.
              countsByOutcome: { passcode_ok: 4, passcode_fail: 37, passcode_exhausted: 2, signup_throttled: 1 },
              recent: [],
            }),
          }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText("Failed match: 37")).toBeInTheDocument();
      expect(screen.getByText("Accepted: 4")).toBeInTheDocument();
      expect(screen.getByText("Code exhausted: 2")).toBeInTheDocument();
      expect(screen.getByText("signup throttled: 1")).toBeInTheDocument();
      expect(screen.getByText("Signup attempts, last 24 hours")).toBeInTheDocument();
    });

    it("labels and highlights the fail-closed and dead-code outcomes, not just wrong guesses", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            attempts: attempts({
              // `passcode_unverifiable` is the gate refusing because an active
              // code would not decrypt -- key trouble, nothing the DJ did. It
              // must read as an alarm, not blend in beside "Accepted".
              countsByOutcome: { passcode_ok: 4, passcode_unverifiable: 3, passcode_expired: 2, passcode_revoked: 1 },
              recent: [],
            }),
          }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      const unverifiable = await screen.findByText("Code unverifiable: 3");
      expect(unverifiable.closest(".MuiChip-colorWarning")).not.toBeNull();
      expect(screen.getByText("Code expired: 2").closest(".MuiChip-colorWarning")).not.toBeNull();
      expect(screen.getByText("Code revoked: 1").closest(".MuiChip-colorWarning")).not.toBeNull();
      expect(screen.getByText("Accepted: 4").closest(".MuiChip-colorWarning")).toBeNull();
    });

    it("says so plainly when the window holds no attempts at all", async () => {
      mockStationSignupRoutes({ "/admin/station-signup/status": { status: 200, data: baseStatus() } });
      renderWithProviders(<StationSignupPanel />);

      expect(await screen.findByText("No signup attempts recorded in this window.")).toBeInTheDocument();
    });

    it("shows when the cooldown was last cleared, so a clear can be confirmed by more than an alert disappearing", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": {
          status: 200,
          data: baseStatus({
            cooldown: heldCooldown({ inCooldown: false, lastClearedAt: "2026-09-06T17:00:00.000Z" }),
          }),
        },
      });
      renderWithProviders(<StationSignupPanel />);

      // 2026-09-06T17:00:00Z is 1:00:00 PM EDT.
      expect(await screen.findByText("Cooldown last cleared 9/6/2026 1:00:00 PM")).toBeInTheDocument();
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

    it("drops the revealed plaintext from the mutation cache on hide, not just off the screen", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/reveal": {
          status: 200,
          data: { passcodes: [{ id: "passcode-1", code: "SUNFLOWER99", expiresAt: "2026-09-15T00:00:00.000Z", useCount: 3, maxUses: 25 }] },
        },
      });
      const { user, store } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Reveal$/i }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^Reveal$/i }));
      expect(await screen.findByText("SUNFLOWER99")).toBeInTheDocument();
      expect(JSON.stringify(store.getState().stationSignupApi.mutations)).toContain("SUNFLOWER99");

      await user.click(screen.getByRole("button", { name: /^Hide$/i }));

      await waitFor(() => expect(screen.queryByText("SUNFLOWER99")).not.toBeInTheDocument());
      expect(JSON.stringify(store.getState().stationSignupApi.mutations)).not.toContain("SUNFLOWER99");
    });

    it("says there is nothing to reveal when the key works but no passcode is active", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus({ passcodes: [] }) },
        "/admin/station-signup/reveal": { status: 200, data: { passcodes: [] } },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Reveal$/i }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^Reveal$/i }));

      expect(await screen.findByText(/no active passcode to reveal/i)).toBeInTheDocument();
      expect(screen.queryByText(/this reveal was logged/i)).not.toBeInTheDocument();
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
          data: baseStatus({ cooldown: heldCooldown({ allFailureCount: 25 }) }),
        },
        "/admin/station-signup/clear-cooldown": {
          status: 200,
          data: {
            cleared: true,
            cooldown: heldCooldown({
              inCooldown: false,
              noMatchFailureCount: 0,
              allFailureCount: 0,
              lastClearedAt: "2026-09-06T18:00:00.000Z",
            }),
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

    it("names the missing key plainly, and keeps it on screen, when a reveal 503s with passcode_key_unset", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/reveal": {
          status: 503,
          data: { error: "STATION_PASSCODE_KEY is not set", code: "passcode_key_unset" },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Reveal$/i }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^Reveal$/i }));

      const fault = await screen.findByTestId("station-signup-service-fault");
      expect(within(fault).getByText(/STATION_PASSCODE_KEY is not set/i)).toBeInTheDocument();
      // A host-level fault outlives a toast, and rotation cannot recover a
      // service that has no key to mint with.
      expect(toast.error).not.toHaveBeenCalled();
      expect(within(fault).queryByRole("button", { name: /^Rotate$/i })).not.toBeInTheDocument();
    });

    it("names rotate as the recovery when a reveal 503s with passcode_undecryptable", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/reveal": {
          status: 503,
          data: { error: "will not decrypt", code: "passcode_undecryptable" },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Reveal$/i }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^Reveal$/i }));

      const fault = await screen.findByTestId("station-signup-service-fault");
      expect(within(fault).getByText(/Rotating administratively revokes/i)).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("makes the stated recovery reachable from the passcode_undecryptable alert itself", async () => {
      mockStationSignupRoutes({
        "/admin/station-signup/status": { status: 200, data: baseStatus() },
        "/admin/station-signup/reveal": {
          status: 503,
          data: { error: "will not decrypt", code: "passcode_undecryptable" },
        },
        "/admin/station-signup/rotate": {
          status: 200,
          data: { id: "passcode-2", code: "MOONBEAM42", expiresAt: "2026-09-20T00:00:00.000Z", maxUses: 25, autoRevokedPasscodeIds: [] },
        },
      });
      const { user } = renderWithProviders(<StationSignupPanel />);

      await user.click(await screen.findByRole("button", { name: /^Reveal$/i }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^Reveal$/i }));

      const fault = await screen.findByTestId("station-signup-service-fault");
      await user.click(within(fault).getByRole("button", { name: /^Rotate$/i }));

      expect(await screen.findByText("MOONBEAM42")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByTestId("station-signup-service-fault")).not.toBeInTheDocument()
      );
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

describe("station signup cooldown countdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("anchors the lift on the newest arming failure, whatever the list order", () => {
    const liftsAt = cooldownLiftsAtMs(
      attempts({
        recent: [
          attemptRow({ id: "a-1", attemptedAt: "2026-09-06T17:57:30.000Z" }),
          attemptRow({ id: "a-2", attemptedAt: "2026-09-06T17:50:00.000Z" }),
        ],
      }),
      15
    );

    expect(liftsAt).toBe(Date.parse("2026-09-06T18:12:30.000Z"));
  });

  it("ignores the failure outcomes that are exempt from refusal", () => {
    const liftsAt = cooldownLiftsAtMs(
      attempts({
        recent: [
          attemptRow({ id: "a-1", attemptedAt: "2026-09-06T17:57:30.000Z" }),
          attemptRow({ id: "a-2", attemptedAt: "2026-09-06T17:59:00.000Z", outcome: "cooldown_refused" }),
          attemptRow({ id: "a-3", attemptedAt: "2026-09-06T17:59:30.000Z", outcome: "passcode_exhausted" }),
        ],
      }),
      15
    );

    expect(liftsAt).toBe(Date.parse("2026-09-06T18:12:30.000Z"));
  });

  it("has nothing to count down to when the log holds no arming failure", () => {
    expect(cooldownLiftsAtMs(attempts({ recent: [attemptRow({ outcome: "passcode_ok" })] }), 15)).toBeNull();
  });

  it.each([
    [45_000, "45s"],
    [750_000, "12m 30s"],
    [720_000, "12m 00s"],
    [7_140_000, "1h 59m"],
    [-1_000, "0s"],
  ])("formats %i ms of remaining hold as %s", (remainingMs, expected) => {
    expect(formatHoldRemaining(remainingMs)).toBe(expected);
  });

  it("starts at the server's own instant and advances with wall time, not with the browser's clock reading", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));

    const { result } = renderHook(() => useServerClockMs("2026-09-06T18:00:00.000Z", 1_000));

    // A browser clock years off does not drag the countdown with it.
    expect(result.current).toBe(Date.parse("2026-09-06T18:00:00.000Z"));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toBe(Date.parse("2026-09-06T18:00:05.000Z"));
  });

  it("holds still when nothing is counting down", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T18:00:00.000Z"));

    const { result } = renderHook(() => useServerClockMs("2026-09-06T18:00:00.000Z", null));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toBe(Date.parse("2026-09-06T18:00:00.000Z"));
  });
});
