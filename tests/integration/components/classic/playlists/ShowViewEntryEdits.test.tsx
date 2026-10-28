import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import {
  createTestV2MessageEntry,
  createTestV2ShowEndEntry,
  createTestV2TalksetEntry,
  createTestV2TrackEntry,
} from "@/tests/fixtures/fixtures";
import { Authorization } from "@/lib/features/admin/types";
import {
  CLOSED_SHOW_SENTENCE,
  NOT_ON_SHOW_SENTENCE,
} from "@/lib/features/show-playlist/api";
import ShowView from "@/src/components/experiences/classic/playlists/ShowView";

const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async (importOriginal) => {
  const { createAuthenticationHookMock } = await import(
    "@/tests/helpers/auth-hook-mock"
  );
  return {
    ...(await importOriginal<typeof import("@/src/hooks/authenticationHooks")>()),
    ...createAuthenticationHookMock(mockAuth),
  };
});

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { error: toastError },
}));

const SHOW_ID = 1951179;

const track = (id: number, play_order: number, track_title: string) =>
  createTestV2TrackEntry({
    id,
    show_id: SHOW_ID,
    play_order,
    artist_name: "Juana Molina",
    track_title,
    album_title: "DOGA",
  });

const show = (over: {
  end_time: string | null;
  show_djs?: unknown[];
  entries?: unknown[];
}) => ({
  id: SHOW_ID,
  show_name: "Sonamos Hour",
  specialty_show_name: "",
  start_time: "2026-08-22T20:36:00.000Z",
  dj_name_override: null,
  legacy_dj_name: null,
  previous_show_id: null,
  next_show_id: null,
  show_djs: [],
  entries: [track(3001, 1, "la paradoja"), track(3002, 2, "cosas de la vida")],
  ...over,
});

let playlistGets = 0;
const servePlaylist = (body: ReturnType<typeof show>) =>
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/playlist`, () => {
      playlistGets += 1;
      return HttpResponse.json(body);
    }),
  );

const ended = show({ end_time: "2026-08-23T00:01:00.000Z" });
const onAir = show({ end_time: null, show_djs: [{ id: "dj-me", dj_name: "Me" }] });
const rowOf = (title: string) => screen.getByText(title).closest("tr")!;

beforeEach(() => {
  playlistGets = 0;
  toastError.mockClear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("classic ShowView entry editing", () => {
  it.each([
    ["music director", Authorization.MD, ended, true],
    ["station manager", Authorization.SM, ended, true],
    ["DJ", Authorization.DJ, ended, false],
    ["DJ on the show", Authorization.DJ, onAir, true],
    ["DJ not on the show", Authorization.DJ, show({ end_time: null }), false],
    ["music director not on the show", Authorization.MD, show({ end_time: null }), true],
  ])(
    "offers a %s edit, delete and reorder controls: %s",
    async (_role, authority, body, offered) => {
      mockAuth.authority = authority;
      servePlaylist(body);
      const { container } = renderWithProviders(<ShowView showId={SHOW_ID} />);

      await screen.findByText("la paradoja");
      expect(screen.queryAllByLabelText("Actions").length > 0).toBe(offered);
      expect(screen.queryAllByLabelText("Drag to reorder").length > 0).toBe(offered);
      // Only the controls differ: the table keeps the same columns whoever is
      // looking, and whether or not the show has ended.
      expect(
        [...container.querySelectorAll(".entry-table thead th")].map(
          (th) => th.textContent,
        ),
      ).toEqual(["", "Time", "", "Playlist", "Req.", "Artist", "Song", "Release", "Label", ""]);
    },
  );

  it("keeps the highlighted row's anchor on an editable row", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    renderWithProviders(<ShowView showId={SHOW_ID} highlightedEntryId={3002} />);

    await screen.findByText("la paradoja");
    expect(rowOf("cosas de la vida")).toHaveClass("playlistEntryHighlight");
    expect(rowOf("cosas de la vida").id).not.toBe("");
    expect(rowOf("la paradoja").id).toBe("");
  });

  it("sends the delete and refetches the show", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    let body: unknown;
    server.use(
      http.delete(`${TEST_BACKEND_URL}/flowsheet`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    await user.click(screen.getAllByLabelText("Actions")[0]);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(body).toEqual({ entry_id: 3001 });
  });

  it("sends the edit and refetches the show", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    let body: unknown;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    await user.click(screen.getAllByLabelText("Actions")[0]);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    const input = screen.getByDisplayValue("la paradoja");
    await user.clear(input);
    await user.type(input, "la paradoja (edit){enter}");

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(body).toMatchObject({
      entry_id: 3001,
      data: { track_title: "la paradoja (edit)" },
    });
  });

  it("drops one row on another as a play-order move, then refetches the show", async () => {
    mockAuth.authority = Authorization.SM;
    servePlaylist(ended);
    let body: unknown;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    fireEvent.dragStart(rowOf("la paradoja"));
    fireEvent.dragOver(rowOf("cosas de la vida"));
    fireEvent.drop(rowOf("cosas de la vida"));

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(body).toEqual({ entry_id: 3001, new_position: 2 });
  });

  it("sends no move when a row is dropped on itself", async () => {
    mockAuth.authority = Authorization.SM;
    servePlaylist(ended);
    let moves = 0;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, () => {
        moves += 1;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    fireEvent.dragStart(rowOf("la paradoja"));
    fireEvent.drop(rowOf("la paradoja"));
    // A sentinel move proves the handler ran and settled before the assertion.
    fireEvent.dragStart(rowOf("la paradoja"));
    fireEvent.drop(rowOf("cosas de la vida"));

    await waitFor(() => expect(moves).toBe(1));
  });

  it.each([
    ["a closed_show 403", 403, { code: "closed_show", message: "Show closed" }, CLOSED_SHOW_SENTENCE],
    ["a 400", 400, { message: "DJ not a member of show" }, NOT_ON_SHOW_SENTENCE],
  ])("words a refused reorder as %s with one sentence", async (_name, status, payload, sentence) => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, () =>
        HttpResponse.json(payload, { status }),
      ),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    fireEvent.dragStart(rowOf("la paradoja"));
    fireEvent.drop(rowOf("cosas de la vida"));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(sentence));
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("does not word a reorder 403 without a code as the closed-show sentence", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    fireEvent.dragStart(rowOf("la paradoja"));
    fireEvent.drop(rowOf("cosas de la vida"));

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(toastError).not.toHaveBeenCalledWith(CLOSED_SHOW_SENTENCE);
  });

  it("leaves a show_end marker row without a drag handle", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(
      show({
        end_time: "2026-08-23T00:01:00.000Z",
        entries: [track(3001, 1, "la paradoja"), createTestV2ShowEndEntry({ id: 3002, show_id: SHOW_ID, play_order: 2 })],
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    expect(screen.getAllByLabelText("Drag to reorder")).toHaveLength(1);
  });

  it("shows a message row with a delete control, so the editable table never lists fewer rows than the read-only one", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(
      show({
        end_time: "2026-08-23T00:01:00.000Z",
        entries: [
          track(3001, 1, "la paradoja"),
          createTestV2MessageEntry({
            id: 3002,
            show_id: SHOW_ID,
            play_order: 2,
            message: "Station ID reminder",
          }),
        ],
      }),
    );
    let body: unknown;
    server.use(
      http.delete(`${TEST_BACKEND_URL}/flowsheet`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    expect(screen.getByText("Station ID reminder")).toBeInTheDocument();
    await user.click(
      within(rowOf("Station ID reminder")).getByLabelText("Actions"),
    );
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => expect(body).toEqual({ entry_id: 3002 }));
  });

  it("keeps the Time column and the indicator capsules the read-only table shows", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(
      show({
        end_time: "2026-08-23T00:01:00.000Z",
        entries: [
          createTestV2TrackEntry({
            id: 3001,
            show_id: SHOW_ID,
            play_order: 1,
            track_title: "la paradoja",
            rotation_bin: "H",
            request_flag: true,
            on_streaming: false,
            add_time: "2026-08-22T20:40:00.000Z",
          }),
          createTestV2TalksetEntry({
            id: 3002,
            show_id: SHOW_ID,
            play_order: 2,
            add_time: "2026-08-22T20:50:00.000Z",
          }),
        ],
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja");
    expect(
      screen.getByRole("columnheader", { name: "Time" }),
    ).toBeInTheDocument();
    const songRow = within(rowOf("la paradoja"));
    expect(songRow.getByText("4:40 PM")).toBeInTheDocument();
    expect(songRow.getByText("ROTATION H")).toBeInTheDocument();
    expect(songRow.getByText("REQUEST")).toBeInTheDocument();
    expect(songRow.getByText("EXCLUSIVE")).toBeInTheDocument();
    expect(
      within(screen.getByText(/talkset/i).closest("tr")!).getByText("4:50 PM"),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "a talkset",
      createTestV2TalksetEntry({ id: 3002, show_id: SHOW_ID, play_order: 2 }),
      /talkset/i,
    ],
    [
      "a message",
      createTestV2MessageEntry({
        id: 3002,
        show_id: SHOW_ID,
        play_order: 2,
        message: "Station ID reminder",
      }),
      /Station ID reminder/,
    ],
    [
      "a show end",
      createTestV2ShowEndEntry({ id: 3002, show_id: SHOW_ID, play_order: 2 }),
      /ended the set/,
    ],
  ])(
    "anchors and highlights %s row a search result linked to",
    async (_kind, entry, text) => {
      mockAuth.authority = Authorization.MD;
      servePlaylist(
        show({
          end_time: "2026-08-23T00:01:00.000Z",
          entries: [track(3001, 1, "la paradoja"), entry],
        }),
      );
      renderWithProviders(
        <ShowView showId={SHOW_ID} highlightedEntryId={3002} />,
      );

      await screen.findByText("la paradoja");
      const row = screen.getByText(text).closest("tr")!;
      expect(row).toHaveClass("playlistEntryHighlight");
      expect(row.id).not.toBe("");
      expect(rowOf("la paradoja").id).toBe("");
    },
  );
});
