import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import {
  createTestV2ShowEndEntry,
  createTestV2TrackEntry,
} from "@/tests/fixtures/fixtures";
import { Authorization } from "@/lib/features/admin/types";
import {
  CLOSED_SHOW_SENTENCE,
  NOT_ON_SHOW_SENTENCE,
} from "@/lib/features/show-playlist/api";
import ShowView from "@/src/components/experiences/modern/previous-sets/ShowView";

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
  entries: [
    createTestV2TrackEntry({
      id: 3001,
      show_id: SHOW_ID,
      play_order: 1,
      artist_name: "Juana Molina",
      track_title: "la paradoja",
      album_title: "DOGA",
    }),
  ],
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

const track = (id: number, play_order: number) =>
  createTestV2TrackEntry({
    id,
    show_id: SHOW_ID,
    play_order,
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
  });
const showEnd = (id: number, play_order: number) =>
  createTestV2ShowEndEntry({ id, show_id: SHOW_ID, play_order });

beforeEach(() => {
  playlistGets = 0;
  toastError.mockClear();
});

describe("ShowView entry editing", () => {
  it.each([
    ["music director", Authorization.MD, true],
    ["station manager", Authorization.SM, true],
    ["DJ", Authorization.DJ, false],
  ])("an ended show's rows for a %s: controls %s", async (_role, authority, offered) => {
    mockAuth.authority = authority;
    servePlaylist(ended);
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findAllByText("la paradoja");
    expect(screen.queryByTestId("flowsheet-remove-3001") !== null).toBe(offered);
    expect(screen.queryAllByLabelText("Edit song").length > 0).toBe(offered);
  });

  it("offers a show's own DJ no controls once the show has ended", async () => {
    mockAuth.authority = Authorization.DJ;
    servePlaylist(
      show({
        end_time: "2026-08-23T00:01:00.000Z",
        show_djs: [{ id: "dj-me", dj_name: "Me" }],
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findAllByText("la paradoja");
    expect(screen.queryByTestId("flowsheet-remove-3001")).toBeNull();
    expect(screen.queryAllByLabelText("Edit song")).toHaveLength(0);
  });

  // The server counts a closing show_end row as the end even when end_time was
  // never written, so the controls follow it. The marker is listed first to show
  // that the newest row is found by id, not by position in the payload.
  it.each([
    ["music director not on the show: controls", Authorization.MD, [], true],
    ["DJ on the show: no controls", Authorization.DJ, [{ id: "dj-me", dj_name: "Me" }], false],
  ])(
    "a show closed by a show_end row with no end_time, for a %s",
    async (_role, authority, show_djs, offered) => {
      mockAuth.authority = authority;
      servePlaylist(
        show({
          end_time: null,
          show_djs,
          entries: [showEnd(3002, 2), track(3001, 1)],
        }),
      );
      renderWithProviders(<ShowView showId={SHOW_ID} />);

      await screen.findAllByText("la paradoja");
      expect(screen.queryByTestId("flowsheet-remove-3001") !== null).toBe(offered);
    },
  );

  it("offers a DJ on the show its rows when a row follows an earlier show_end", async () => {
    mockAuth.authority = Authorization.DJ;
    servePlaylist(
      show({
        end_time: null,
        show_djs: [{ id: "dj-me", dj_name: "Me" }],
        entries: [track(3003, 3), showEnd(3002, 2), track(3001, 1)],
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    expect(await screen.findByTestId("flowsheet-remove-3003")).toBeInTheDocument();
  });

  it("offers a DJ on the show its rows while it is on the air", async () => {
    mockAuth.authority = Authorization.DJ;
    servePlaylist(show({ end_time: null, show_djs: [{ id: "dj-me", dj_name: "Me" }] }));
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    expect(await screen.findByTestId("flowsheet-remove-3001")).toBeInTheDocument();
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

    await user.click(await screen.findByTestId("flowsheet-remove-3001"));

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(body).toEqual({ entry_id: 3001 });
  });

  it("sends the edit with the row's id and fields", async () => {
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

    await user.click((await screen.findAllByLabelText("Edit song"))[0]);
    const input = screen.getByDisplayValue("la paradoja");
    await user.clear(input);
    await user.type(input, "la paradoja (edit){enter}");

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(body).toEqual({
      entry_id: 3001,
      data: { track_title: "la paradoja (edit)" },
    });
  });

  it.each([
    ["a closed_show 403", 403, { code: "closed_show", message: "Show closed" }, CLOSED_SHOW_SENTENCE],
    ["a 400", 400, { message: "DJ not a member of show" }, NOT_ON_SHOW_SENTENCE],
  ])("words %s as one sentence", async (_name, status, payload, sentence) => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.delete(`${TEST_BACKEND_URL}/flowsheet`, () =>
        HttpResponse.json(payload, { status }),
      ),
    );
    const { user } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await user.click(await screen.findByTestId("flowsheet-remove-3001"));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(sentence));
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("does not word a 403 without a code as the closed-show sentence", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.delete(`${TEST_BACKEND_URL}/flowsheet`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );
    const { user } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await user.click(await screen.findByTestId("flowsheet-remove-3001"));

    // The failed delete still invalidates the tag, so the refetch (2) marks
    // the point after the 403 has been handled.
    await waitFor(() => expect(playlistGets).toBe(2));
    expect(toastError).not.toHaveBeenCalledWith(CLOSED_SHOW_SENTENCE);
  });
});
