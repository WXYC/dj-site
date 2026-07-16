import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

const leaveMock = vi.fn();
const pushMock = vi.fn();
let liveMock = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: liveMock, leave: leaveMock }),
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ info: { real_name: "Test DJ" } }),
}));

vi.mock("@/src/utils/helpScreen", () => ({
  OpenHelp: vi.fn(),
}));

import ActionsBar from "../ActionsBar";

beforeEach(() => {
  leaveMock.mockReset();
  pushMock.mockReset();
  liveMock = true;
});

describe("Classic ActionsBar — End-Show consolidation", () => {
  it("renders a single 'End Show' link when the DJ is live", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: /^end show$/i })).toBeDefined();
  });

  it("does NOT render 'Sign Out When Finished!' when live", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.queryByText(/sign out when finished/i)).toBeNull();
  });

  it("does NOT render a 'Log Out' link when live", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.queryByRole("link", { name: /^log out$/i })).toBeNull();
  });

  it("calls leave() exactly once when 'End Show' is clicked", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("link", { name: /^end show$/i }));
    expect(leaveMock).toHaveBeenCalledTimes(1);
  });

  it("redirects to /login?loginAction=endSession after ending the show", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("link", { name: /^end show$/i }));
    expect(pushMock).toHaveBeenCalledWith("/login?loginAction=endSession");
  });

  it("shows 'Not currently live' instead of End Show when not live", () => {
    liveMock = false;
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.queryByRole("link", { name: /^end show$/i })).toBeNull();
    expect(screen.getByText(/not currently live/i)).toBeDefined();
  });

  it("still renders the Help link", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: /^help$/i })).toBeDefined();
  });

  it("still renders the Add Talkset and Last 24 Hours links", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.getByText(/add a talkset/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /last 24 hours/i })).toBeDefined();
  });

  it("does NOT render the 'Add Breakpoint' link (tubafrenzy is the sole hourly-breakpoint source)", () => {
    renderWithProviders(
      <ActionsBar onAddTalkset={vi.fn()} />
    );
    expect(screen.queryByText(/breakpoint/i)).toBeNull();
  });
});
