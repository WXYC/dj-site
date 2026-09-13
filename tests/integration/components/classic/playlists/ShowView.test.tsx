import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  CAPSULE_SELECTOR,
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
  previous_show_id: null,
  next_show_id: null,
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
  [...row.querySelectorAll(CAPSULE_SELECTOR)].map((c) => c.textContent);

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

describe("classic archived-show view — the play a search result named", () => {
  it("marks the played track the search result named", async () => {
    serveShow();
    const { container } = renderWithProviders(
      <ShowView showId={SHOW_ID} highlightedEntryId={3002} />
    );

    await rowFor("Jessica Pratt");

    const row = container.querySelector("#entry-3002");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("playlistEntryHighlight");
    expect(row!.textContent).toContain("Back, Baby");
  });

  it("marks nothing else", async () => {
    serveShow();
    const { container } = renderWithProviders(
      <ShowView showId={SHOW_ID} highlightedEntryId={3002} />
    );

    await rowFor("Jessica Pratt");

    expect(container.querySelectorAll(".playlistEntryHighlight")).toHaveLength(
      1
    );
  });

  // The week grid links to a show without naming a play, and a show opened
  // that way has nothing to point at. Awaited first, so the assertion is made
  // against a rendered set rather than against a table still in flight.
  it("marks nothing when the show was opened without a play", async () => {
    serveShow();
    const { container } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await rowFor("Jessica Pratt");

    expect(container.querySelector(".playlistEntryHighlight")).toBeNull();
    expect(container.querySelector('[id^="entry-"]')).toBeNull();
  });

  // The playlist is a client query, so the router's own fragment scroll runs
  // against a DOM that has no such row yet, and never retries.
  it("scrolls the marked row into view once the show's rows arrive", async () => {
    const scrolled: Element[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(
      function (this: Element) {
        scrolled.push(this);
      }
    );

    serveShow();
    const { container } = renderWithProviders(
      <ShowView showId={SHOW_ID} highlightedEntryId={3003} />
    );

    await waitFor(() => {
      expect(scrolled).toContain(container.querySelector("#entry-3003"));
    });

    vi.restoreAllMocks();
  });

  it("scrolls nowhere for a show opened without a play", async () => {
    const scrolled: Element[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(
      function (this: Element) {
        scrolled.push(this);
      }
    );

    serveShow();
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await rowFor("Jessica Pratt");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolled).toHaveLength(0);

    vi.restoreAllMocks();
  });

  // The page wrapper carries the screen inset that print strips back off, so a
  // rename here silently restores an inch of margin to every printed sheet
  // without failing anything else.
  it("wraps the show in the page container the print block targets", async () => {
    serveShow();
    const { container } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await rowFor("Jessica Pratt");
    expect(container.querySelector(".classic-schedule-week")).not.toBeNull();
  });
});


// Three consecutive shows, enough of the archive to walk. The first two sit in
// different station weeks — 2026-08-22 belongs to the week beginning Sunday
// 2026-08-16, 2026-08-23 opens the next one — so stepping from the second to
// the first crosses a boundary that a week-scoped derivation would stop at.
// The middle set's sign-off was never recorded, which is the state most of the
// abandoned shows in the archive are in.
const EARLIEST_SHOW = 1951368;
const ABANDONED_SHOW = 1951369;
const LATEST_SHOW = 1951370;

const archiveShow = (
  id: number,
  fields: Pick<
    ShowPlaylistWire,
    "start_time" | "end_time" | "previous_show_id" | "next_show_id"
  >,
  entry: ShowPlaylistWire["entries"][number]
): ShowPlaylistWire => ({
  id,
  show_name: null,
  specialty_show_name: "",
  show_djs: [],
  dj_name_override: null,
  legacy_dj_name: "DJ Chowder",
  entries: [entry],
  ...fields,
});

const archive: Record<number, ShowPlaylistWire> = {
  [EARLIEST_SHOW]: archiveShow(
    EARLIEST_SHOW,
    {
      start_time: "2026-08-22T20:36:00.000Z",
      end_time: "2026-08-23T00:01:00.000Z",
      previous_show_id: null,
      next_show_id: ABANDONED_SHOW,
    },
    createTestV2TrackEntry({
      id: 4001,
      show_id: EARLIEST_SHOW,
      play_order: 1,
      add_time: "2026-08-22T21:00:00.000Z",
      artist_name: "Juana Molina",
      track_title: "la paradoja",
      album_title: "DOGA",
      record_label: "Sonamos",
    })
  ),
  [ABANDONED_SHOW]: archiveShow(
    ABANDONED_SHOW,
    {
      start_time: "2026-08-23T18:00:00.000Z",
      end_time: null,
      previous_show_id: EARLIEST_SHOW,
      next_show_id: LATEST_SHOW,
    },
    createTestV2TrackEntry({
      id: 4002,
      show_id: ABANDONED_SHOW,
      play_order: 1,
      add_time: "2026-08-23T18:30:00.000Z",
      artist_name: "Jessica Pratt",
      track_title: "Back, Baby",
      album_title: "On Your Own Love Again",
      record_label: "Drag City",
    })
  ),
  [LATEST_SHOW]: archiveShow(
    LATEST_SHOW,
    {
      start_time: "2026-08-24T18:00:00.000Z",
      end_time: "2026-08-24T21:00:00.000Z",
      previous_show_id: ABANDONED_SHOW,
      next_show_id: null,
    },
    createTestV2TrackEntry({
      id: 4003,
      show_id: LATEST_SHOW,
      play_order: 1,
      add_time: "2026-08-24T18:30:00.000Z",
      artist_name: "Chuquimamani-Condori",
      track_title: "Call Your Name",
      album_title: "Edits",
      record_label: "self-released",
    })
  ),
};

const serveArchive = () =>
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/playlist`, ({ request }) => {
      const id = Number(new URL(request.url).searchParams.get("show_id"));
      const show = archive[id];
      return show
        ? HttpResponse.json(show)
        : new HttpResponse(null, { status: 404 });
    })
  );

const PREVIOUS_LINK = "<< Previous Show";
const NEXT_LINK = "Next Show >>";

const hrefOf = (name: string) =>
  screen.getByRole("link", { name }).getAttribute("href");

/** Follows a nav link the way a click would — by the id it actually names. */
const showIdBehind = (name: string) => {
  const href = hrefOf(name)!;
  return Number(new URLSearchParams(href.slice(href.indexOf("?"))).get("show"));
};

describe("classic archived-show view — walking the archive", () => {
  it("links the show that aired before this one", async () => {
    serveArchive();
    renderWithProviders(<ShowView showId={ABANDONED_SHOW} />);

    await screen.findByText("Jessica Pratt");
    expect(hrefOf(PREVIOUS_LINK)).toBe("?show=1951368");
  });

  it("links the show that aired after this one", async () => {
    serveArchive();
    renderWithProviders(<ShowView showId={ABANDONED_SHOW} />);

    await screen.findByText("Jessica Pratt");
    expect(hrefOf(NEXT_LINK)).toBe("?show=1951370");
  });

  it("offers no Previous on the earliest show there is", async () => {
    serveArchive();
    renderWithProviders(<ShowView showId={EARLIEST_SHOW} />);

    await screen.findByText("Juana Molina");
    // Absent, not disabled: an end of the archive is nothing to click.
    expect(screen.queryByRole("link", { name: PREVIOUS_LINK })).toBeNull();
    expect(hrefOf(NEXT_LINK)).toBe("?show=1951369");
  });

  it("offers no Next on the most recent show", async () => {
    serveArchive();
    renderWithProviders(<ShowView showId={LATEST_SHOW} />);

    await screen.findByText("Chuquimamani-Condori");
    expect(screen.queryByRole("link", { name: NEXT_LINK })).toBeNull();
    expect(hrefOf(PREVIOUS_LINK)).toBe("?show=1951369");
  });

  // A null end_time means the sign-off was never recorded — a state thousands
  // of archived sets are in — so reading it as "still on the air" and dropping
  // the next link would strand the walk on any one of them.
  it("keeps Next on a show whose sign-off was never recorded", async () => {
    serveArchive();
    const { container } = renderWithProviders(
      <ShowView showId={ABANDONED_SHOW} />
    );

    await screen.findByText("Jessica Pratt");
    expect(container.querySelector(".show-info-bar")!.textContent).toContain(
      "no sign-off recorded"
    );
    expect(hrefOf(NEXT_LINK)).toBe("?show=1951370");
  });

  // The surface above carries a Search/Week toggle, and a link beside it
  // reading "Weekly View" went to a different week than the toggle did — the
  // show's rather than the current one. The JSP had no such toggle, so
  // reproducing its link faithfully produced a pair that reads as one control
  // and disagrees. The toggle learned the show's week and the link went.
  it("offers no week link of its own", async () => {
    serveArchive();
    renderWithProviders(<ShowView showId={LATEST_SHOW} />);

    await screen.findByText("Chuquimamani-Condori");
    expect(screen.queryByRole("link", { name: /weekly view/i })).toBeNull();
  });

  it("walks backwards out of one station week and into the one before it", async () => {
    serveArchive();
    const { rerender } = renderWithProviders(<ShowView showId={LATEST_SHOW} />);

    const infoBarText = () =>
      document.querySelector(".show-info-bar")!.textContent!;

    await screen.findByText("Chuquimamani-Condori");
    rerender(<ShowView showId={showIdBehind(PREVIOUS_LINK)} />);

    // Sunday opens a station week, so this set and the one the next step
    // reaches sit on opposite sides of a boundary that could otherwise only be
    // crossed by going back out to the calendar. Asserted on the rendered date
    // rather than on a week link: naming the week is the toggle's job now, and
    // this spec's subject is the walk. Each step follows the href actually
    // rendered by the step before it.
    await screen.findByText("Jessica Pratt");
    expect(infoBarText()).toContain("8/23/2026");

    rerender(<ShowView showId={showIdBehind(PREVIOUS_LINK)} />);

    // The step that leaves the week: the set reached aired the evening before,
    // on the Saturday belonging to the previous calendar page.
    await screen.findByText("Juana Molina");
    expect(infoBarText()).toContain("8/22/2026");
  });

  it("reads the neighbours off the show rather than fetching for them", async () => {
    serveArchive();

    const paths: string[] = [];
    const record = ({ request }: { request: Request }) =>
      void paths.push(new URL(request.url).pathname);
    server.events.on("request:start", record);

    try {
      renderWithProviders(<ShowView showId={ABANDONED_SHOW} />);

      await screen.findByText("Jessica Pratt");
      // Both neighbours are on screen, so the ids were resolved somewhere; the
      // point is that resolving them cost no window query either side of this
      // show's start_time, and no widening retry over a gap in the archive.
      expect(hrefOf(PREVIOUS_LINK)).toBe("?show=1951368");
      expect(hrefOf(NEXT_LINK)).toBe("?show=1951370");
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(paths).toEqual(["/flowsheet/playlist"]);
    } finally {
      server.events.removeListener("request:start", record);
    }
  });
});
