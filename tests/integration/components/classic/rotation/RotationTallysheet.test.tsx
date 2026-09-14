import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
const ROTATION = `${TEST_BACKEND_URL}/library/rotation`;

// A Sunday-evening show, so every fixture row sits well inside one station week
// and away from a DST edge.
const SHOW_START = "2026-09-07T00:00:00.000Z";

// The component reads `new Date()` itself and defaults to last week, so the
// clock has to be pinned into the following station week (rather than the
// fixtures derived from the real clock) or the new-adds tail's window check
// against `rotation_add_date` silently drifts off the fixtures over time.
const NOW = "2026-09-16T12:00:00.000Z";

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
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(NOW) });
    server.use(http.get(RANGE, () => HttpResponse.json(rangePayload())));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("keeps the report left-aligned inside a shell that centres its subtree", async () => {
    // The classic shell wraps librarian screens in `text-align: center`. A
    // centred <pre> centres every line independently, which pulls the rule, the
    // rank column and the play counts out of the fixed-width grid the chart is
    // read and pasted in. Asserting on text content cannot see this -- the
    // characters are identical either way -- so it is asserted on the box.
    renderWithProviders(
      <div style={{ textAlign: "center" }}>
        <RotationTallysheet />
      </div>,
    );

    const report = await screen.findByText(/WXYC's Top \d+ Records/);
    // jsdom does not resolve inherited text-align onto the <pre>, so the
    // nearest ancestor that sets it is the thing to assert. Without the
    // screen's own left alignment that ancestor is the centring shell above,
    // and this reads "center".
    const aligned = report.closest<HTMLElement>('[style*="text-align"]');
    expect(aligned).not.toBeNull();
    expect(aligned!.style.textAlign).toBe("left");
  });

  it("says so rather than printing an empty chart when the week cannot be read", async () => {
    server.use(http.get(RANGE, () => HttpResponse.json({ error: "nope" }, { status: 500 })));
    renderWithProviders(<RotationTallysheet />);

    expect(await screen.findByText(/could not be read/)).toBeInTheDocument();
    expect(screen.queryByText(/WXYC's Top/)).not.toBeInTheDocument();
  });

  it("keys the new-adds tail on rotation_add_date, not the library's catalogued add_date", async () => {
    const user = userEvent.setup();

    // Both aired once this week, so both fall below a minimum of 2 and are
    // only reachable through the tail, never the ranked chart.
    server.use(
      http.get(RANGE, () =>
        HttpResponse.json({
          shows: [{ id: 1, start_time: SHOW_START, end_time: null }],
          entries: [
            track(1, "Jessica Pratt", "On Your Own Love Again", "Drag City"),
            track(3, "Chuquimamani-Condori", "Edits", "self-released"),
          ],
        }),
      ),
      http.get(ROTATION, () =>
        HttpResponse.json([
          {
            id: 42,
            code_letters: "PRA",
            code_artist_number: 1,
            code_number: 1,
            artist_name: "Jessica Pratt",
            alphabetical_name: "Pratt, Jessica",
            album_title: "On Your Own Love Again",
            record_label: "Drag City",
            label_id: 5,
            genre_name: "Rock",
            format_name: "CD",
            rotation_id: 1,
            // Catalogued long before this week -- the wrong date the old call
            // site read. Outside the [2026-09-06, 2026-09-13) window, so this
            // row proves the tail follows rotation_add_date and not this field.
            add_date: "2026-01-01",
            // Entered rotation this week -- the date the tail must key on.
            rotation_add_date: "2026-09-08",
            rotation_bin: "H",
            rotation_kill_date: null,
            plays: 1,
            legacy_release_id: 7001,
          },
          {
            // A rotation row with no linked library release: the LEFT JOIN
            // leaves every library-side column, including add_date, NULL.
            id: null,
            code_letters: null,
            code_artist_number: null,
            code_number: null,
            artist_name: "Chuquimamani-Condori",
            alphabetical_name: "Chuquimamani-Condori",
            album_title: "Edits",
            record_label: "self-released",
            label_id: null,
            genre_name: null,
            format_name: null,
            rotation_id: 3,
            add_date: null,
            rotation_add_date: "2026-09-09",
            rotation_bin: "M",
            rotation_kill_date: null,
            plays: 1,
            legacy_release_id: null,
          },
        ]),
      ),
    );

    renderWithProviders(<RotationTallysheet />);
    await screen.findByText(/WXYC's Top \d+ Records/);
    await user.selectOptions(screen.getByLabelText("Minimum number of plays"), "2");

    await waitFor(() => {
      const report = screen.getByText(/WXYC's Top 0 Records/);
      expect(report.textContent).toContain(
        "Other records that were just added to this week's playlist but are not listed above:",
      );
      // Catalogued in January, but the read must not key on that -- it is
      // named here because it entered rotation this week.
      expect(report.textContent).toContain(
        "Jessica Pratt - On Your Own Love Again (Drag City)",
      );
      // Never catalogued at all (add_date is NULL), yet it must still appear
      // because it entered rotation this week -- the old guard let a runtime
      // `null` silently drop rows exactly like this one out of the tail.
      expect(report.textContent).toContain("Chuquimamani-Condori - Edits (self-released)");
    });
  });
});
