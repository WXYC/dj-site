import { describe, it, expect, vi } from "vitest";
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

const user = { username: "sm", authority: Authorization.SM } as User;

function renderSwitcher() {
  return renderWithProviders(
    <RosterViewSwitcher user={user} organizationSlug="wxyc" />
  );
}

describe("RosterViewSwitcher", () => {
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
