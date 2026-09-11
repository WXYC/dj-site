import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  createTestV2TalksetEntry,
  createTestV2TrackEntry,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import type { ShowPlaylistWire } from "@/lib/features/show-playlist/types";
import { RotationBin } from "@/lib/features/rotation/types";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

import ShowView from "@/src/components/experiences/classic/playlists/ShowView";

const SHOW_ID = 1951179;

// Built through the repo's V2 factories, which are typed from the published
// union rather than from a local mirror of the payload. A fixture written
// against a mirror asserts its own spelling of the field names back to itself,
// so a rename upstream leaves this file green and the gutter empty in
// production — which is the failure this whole fixture exists to catch.
const play = (
  id: number,
  play_order: number,
  fields: Parameters<typeof createTestV2TrackEntry>[0]
) =>
  createTestV2TrackEntry({
    id,
    show_id: SHOW_ID,
    play_order,
    add_time: "2026-08-22T21:00:00.000Z",
    request_flag: false,
    ...fields,
  });

// One show carrying every state the indicator gutter has to tell apart.
const playlist: ShowPlaylistWire = {
  id: SHOW_ID,
  show_name: null,
  specialty_show_name: "",
  start_time: "2026-08-22T20:36:00.000Z",
  end_time: "2026-08-23T00:01:00.000Z",
  show_djs: [],
  dj_name_override: null,
  legacy_dj_name: "DJ Chowder",
  entries: [
    play(3001, 1, {
      artist_name: "Juana Molina",
      track_title: "la paradoja",
      album_title: "DOGA",
      record_label: "Sonamos",
      rotation_bin: RotationBin.H,
      on_streaming: true,
    }),
    play(3002, 2, {
      artist_name: "Jessica Pratt",
      track_title: "Back, Baby",
      album_title: "On Your Own Love Again",
      record_label: "Drag City",
      request_flag: true,
      on_streaming: true,
    }),
    play(3003, 3, {
      artist_name: "Chuquimamani-Condori",
      track_title: "Call Your Name",
      album_title: "Edits",
      record_label: "self-released",
      on_streaming: false,
    }),
    play(3004, 4, {
      artist_name: "Duke Ellington & John Coltrane",
      track_title: "In a Sentimental Mood",
      album_title: "Duke Ellington & John Coltrane",
      record_label: "Impulse Records",
      on_streaming: null,
    }),
    createTestV2TalksetEntry({
      id: 3005,
      show_id: SHOW_ID,
      play_order: 5,
      add_time: "2026-08-22T22:00:00.000Z",
      message: "TALKSET",
    }),
  ],
};

const serveShow = (body: ShowPlaylistWire = playlist) =>
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/playlist`, () =>
      HttpResponse.json(body)
    )
  );

/** The row carrying a given cell's text. The Ellington/Coltrane release is
 *  self-titled, so a row is addressed by whichever of its cells is unique. */
const rowFor = async (cellText: string) =>
  (await screen.findByText(cellText)).closest("tr")!;

const capsulesOf = (row: HTMLElement) =>
  [...row.querySelectorAll(".classic-capsule")].map((c) => c.textContent);

describe("classic archived-show view — flowsheetRadioShowDisplayPublic.jsp", () => {
  it("badges the rotation bin the release is filed under", async () => {
    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    expect(capsulesOf(await rowFor("Juana Molina"))).toEqual(["ROTATION H"]);
  });

  it("badges a requested playcut", async () => {
    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    expect(capsulesOf(await rowFor("Jessica Pratt"))).toEqual(["REQUEST"]);
  });

  it("badges a release known not to be on streaming", async () => {
    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    expect(capsulesOf(await rowFor("Chuquimamani-Condori"))).toEqual([
      "EXCLUSIVE",
    ]);
  });

  // A null on_streaming means the play has no linked library row at all, so
  // the screen knows nothing about its streaming status and says nothing.
  it("badges nothing when streaming status is unknown", async () => {
    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    expect(capsulesOf(await rowFor("In a Sentimental Mood"))).toEqual([]);
  });

  it("carries the label column the search screen and the JSP both show", async () => {
    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    const row = await rowFor("Chuquimamani-Condori");
    expect(within(row).getByText("self-released")).toBeInTheDocument();
  });

  it("keeps a talkset's time and spans it across the remaining columns", async () => {
    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    const row = (await screen.findByText("Talkset")).closest("tr")!;
    const cells = row.querySelectorAll("td");
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe("6:00 PM");
    expect(cells[1].getAttribute("colspan")).toBe("5");
  });
});
