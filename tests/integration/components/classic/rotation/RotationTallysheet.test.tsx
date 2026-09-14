import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

import RotationTallysheet from "@/src/components/experiences/classic/rotation/RotationTallysheet";

const RANGE = `${TEST_BACKEND_URL}/flowsheet/range`;

// A Sunday-evening show, so every fixture row sits well inside one station week
// and away from a DST edge.
const SHOW_START = "2026-09-07T00:00:00.000Z";

let nextId = 1;
const track = (rotationId: number, artist: string, title: string, label: string) => ({
  id: nextId++,
  show_id: 1,
  play_order: nextId,
  entry_type: "track",
  add_time: SHOW_START,
  request_flag: false,
  rotation_id: rotationId,
  artist_name: artist,
  album_title: title,
  record_label: label,
});

const rangePayload = () => ({
  shows: [{ id: 1, start_time: SHOW_START, end_time: null }],
  entries: [
    track(1, "Jessica Pratt", "On Your Own Love Again", "Drag City"),
    track(2, "Juana Molina", "DOGA", "Sonamos"),
    track(2, "Juana Molina", "DOGA", "Sonamos"),
    {
      id: nextId++,
      show_id: 1,
      play_order: nextId,
      entry_type: "breakpoint",
      add_time: "2026-09-07T01:00:00.000Z",
      radio_hour: "2026-09-07T01:00:00.000Z",
      request_flag: false,
    },
    track(2, "Juana Molina", "DOGA", "Sonamos"),
  ],
});

describe("RotationTallysheet", () => {
  beforeEach(() => {
    nextId = 1;
    server.use(http.get(RANGE, () => HttpResponse.json(rangePayload())));
  });

  it("renders the report in the shape the station mails out", async () => {
    renderWithProviders(<RotationTallysheet />);

    const report = await screen.findByText(/WXYC's Top \d+ Records/);
    // Juana Molina spun three times but across two declared hours, so she
    // leads on two plays; the two spins inside the first hour count once.
    expect(report.textContent).toContain(
      "Rank (Plays) Artist - 'Title of CD/LP/EP/7-inch' (RECORD LABEL)",
    );
    expect(report.textContent).toContain("1 (2) Juana Molina - DOGA (Sonamos)");
    expect(report.textContent).toContain(
      "2 (1) Jessica Pratt - On Your Own Love Again (Drag City)",
    );
  });

  it("drops rows beneath the chosen minimum, and retitles for the shorter chart", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RotationTallysheet />);
    await screen.findByText(/WXYC's Top 2 Records/);

    await user.selectOptions(screen.getByLabelText("Minimum number of plays"), "2");

    await waitFor(() => {
      const report = screen.getByText(/WXYC's Top 1 Records/);
      expect(report.textContent).toContain("1 (2) Juana Molina - DOGA (Sonamos)");
      expect(report.textContent).not.toContain("Jessica Pratt");
    });
  });

  it("says so rather than printing an empty chart when the week cannot be read", async () => {
    server.use(http.get(RANGE, () => HttpResponse.json({ error: "nope" }, { status: 500 })));
    renderWithProviders(<RotationTallysheet />);

    expect(await screen.findByText(/could not be read/)).toBeInTheDocument();
    expect(screen.queryByText(/WXYC's Top/)).not.toBeInTheDocument();
  });
});
