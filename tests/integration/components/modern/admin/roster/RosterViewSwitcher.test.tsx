import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";
import type { User } from "@/lib/features/authentication/types";
import RosterViewSwitcher from "@/src/components/experiences/modern/admin/roster/RosterViewSwitcher";

// Stub the two heavy children: this test is about the toggle, not their
// internals. Each stub records that it rendered and echoes the props the
// switcher forwards, so we also prove RosterTable still receives its
// server-derived props through the switcher.
vi.mock("@/src/components/experiences/modern/admin/roster/RosterTable", () => ({
  default: ({ organizationSlug }: { organizationSlug: string }) => (
    <div data-testid="roster-table">roster:{organizationSlug}</div>
  ),
}));
vi.mock("@/src/components/experiences/modern/admin/roster/StationSignupPanel", () => ({
  default: () => <div data-testid="station-signup-panel">passcode</div>,
}));

const ADMIN_FLAG_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED";

const user = { username: "sm", authority: Authorization.SM } as User;

function renderSwitcher() {
  return renderWithProviders(
    <RosterViewSwitcher user={user} organizationSlug="wxyc" />
  );
}

describe("RosterViewSwitcher", () => {
  // The passcode surface is admin-flag-gated: the segmented control and the
  // Signup Passcode view only exist when NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED
  // is on. Toggle it per-block via process.env, the same render-time build flag
  // pattern EmailOTPForm's tests use for the QR entry link.
  describe("when the station-signup admin flag is on", () => {
    beforeEach(() => {
      process.env[ADMIN_FLAG_KEY] = "true";
    });

    afterEach(() => {
      delete process.env[ADMIN_FLAG_KEY];
    });

    it("defaults to the roster view and forwards its props", () => {
      renderSwitcher();

      expect(screen.getByTestId("roster-table")).toHaveTextContent("roster:wxyc");
      expect(screen.queryByTestId("station-signup-panel")).not.toBeInTheDocument();
    });

    it("offers both views as a segmented control", () => {
      renderSwitcher();

      expect(screen.getByRole("button", { name: "DJ Roster" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Signup Passcode" })).toBeInTheDocument();
    });

    it("shows the passcode panel and hides the roster when Signup Passcode is chosen", async () => {
      const { user: ui } = renderSwitcher();

      await ui.click(screen.getByRole("button", { name: "Signup Passcode" }));

      expect(screen.getByTestId("station-signup-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("roster-table")).not.toBeInTheDocument();
    });

    it("toggles back to the roster", async () => {
      const { user: ui } = renderSwitcher();

      await ui.click(screen.getByRole("button", { name: "Signup Passcode" }));
      await ui.click(screen.getByRole("button", { name: "DJ Roster" }));

      expect(screen.getByTestId("roster-table")).toBeInTheDocument();
      expect(screen.queryByTestId("station-signup-panel")).not.toBeInTheDocument();
    });

    it("keeps a view selected when the active button is clicked again", async () => {
      const { user: ui } = renderSwitcher();

      // Re-clicking the active segment must not clear the selection into an
      // empty state — one view is always shown.
      await ui.click(screen.getByRole("button", { name: "DJ Roster" }));

      expect(screen.getByTestId("roster-table")).toBeInTheDocument();
      expect(screen.queryByTestId("station-signup-panel")).not.toBeInTheDocument();
    });
  });

  // Pre-launch default: the passcode surface must not exist. With only one view
  // there is no toggle, so the segmented control disappears entirely and the
  // roster table stands alone — no Signup Passcode segment, no panel.
  describe("when the station-signup admin flag is off", () => {
    beforeEach(() => {
      delete process.env[ADMIN_FLAG_KEY];
    });

    it("renders the roster table alone with no segmented control", () => {
      renderSwitcher();

      expect(screen.getByTestId("roster-table")).toHaveTextContent("roster:wxyc");
      expect(screen.queryByRole("button", { name: "DJ Roster" })).not.toBeInTheDocument();
    });

    it("hides the Signup Passcode segment", () => {
      renderSwitcher();

      expect(
        screen.queryByRole("button", { name: "Signup Passcode" })
      ).not.toBeInTheDocument();
    });

    it("never mounts the station signup panel", () => {
      renderSwitcher();

      expect(screen.queryByTestId("station-signup-panel")).not.toBeInTheDocument();
    });
  });
});
