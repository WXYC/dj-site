import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { createTestStore, renderWithProviders } from "@/tests/helpers";
import SSEConnectionIndicator from "./SSEConnectionIndicator";
import {
  liveUpdatesConnectionStateChanged,
  type LiveUpdatesConnectionStatus,
} from "@/lib/features/flowsheet/live-updates-slice";

const STATUS_LABELS: Record<LiveUpdatesConnectionStatus, string> = {
  closed: "Live updates: off",
  connecting: "Live updates: connecting…",
  connected: "Live updates: connected",
  reconnecting: "Live updates: reconnecting…",
};

describe("SSEConnectionIndicator", () => {
  it("defaults to the 'closed' label when no status has been dispatched", () => {
    renderWithProviders(<SSEConnectionIndicator />);
    expect(
      screen.getByLabelText(STATUS_LABELS.closed)
    ).toBeInTheDocument();
  });

  it.each(
    Object.entries(STATUS_LABELS) as Array<
      [LiveUpdatesConnectionStatus, string]
    >
  )("renders the %s label and data-status attribute", (status, label) => {
    const store = createTestStore();
    store.dispatch(liveUpdatesConnectionStateChanged(status));
    renderWithProviders(<SSEConnectionIndicator />, { store });
    const dot = screen.getByLabelText(label);
    expect(dot).toBeInTheDocument();
    expect(dot.getAttribute("data-status")).toBe(status);
  });
});
