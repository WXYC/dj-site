import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { createTestStore } from "@/tests/helpers/store";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { showPlaylistApi } from "@/lib/features/show-playlist/api";
import { createTestV2TrackEntry } from "@/tests/fixtures/fixtures";
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

vi.mock("@/src/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));

const SHOW_ID = 1951179;

const track = (id: number, play_order: number) =>
  createTestV2TrackEntry({
    id,
    show_id: SHOW_ID,
    play_order,
    artist_name: "Juana Molina",
    track_title: `la paradoja ${id}`,
    album_title: "DOGA",
  });

const show = (over: { end_time: string | null; show_djs?: unknown[] }) => ({
  id: SHOW_ID,
  show_name: "Sonamos Hour",
  specialty_show_name: "",
  start_time: "2026-08-22T20:36:00.000Z",
  dj_name_override: null,
  legacy_dj_name: null,
  previous_show_id: null,
  next_show_id: null,
  show_djs: [],
  entries: [track(3002, 2), track(3001, 1)],
  ...over,
});

const ended = show({ end_time: "2026-08-23T00:01:00.000Z" });
const onAir = show({ end_time: null, show_djs: [{ id: "dj-me", dj_name: "Me" }] });

let playlistGets = 0;
const servePlaylist = (body: ReturnType<typeof show>) =>
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/playlist`, () => {
      playlistGets += 1;
      return HttpResponse.json(body);
    }),
  );


const moveButtons = () => screen.queryAllByRole("button", { name: /^Move (up|down)$/ });

beforeEach(() => {
  playlistGets = 0;
  toastError.mockClear();
});

describe("ShowView mobile cards", () => {
  it.each([
    ["music director", Authorization.MD, ended, true],
    ["station manager", Authorization.SM, ended, true],
    ["DJ", Authorization.DJ, ended, false],
    ["DJ on the air", Authorization.DJ, onAir, true],
    ["music director not on the air show", Authorization.MD, show({ end_time: null }), false],
  ])("a %s sees move buttons: %s", async (_role, authority, body, offered) => {
    mockAuth.authority = authority;
    servePlaylist(body);
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findByText("la paradoja 3001");
    expect(moveButtons().length > 0).toBe(offered);
  });

  it("bounds the buttons at the first and last rows", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    renderWithProviders(<ShowView showId={SHOW_ID} />);
    await screen.findByText("la paradoja 3001");

    const buttons = moveButtons();
    expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([
      true, // first row: up
      false, // first row: down
      false, // last row: up
      true, // last row: down
    ]);
  });

  it("sends the move to play-order, refetches the show, and leaves the live entries cache alone", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.json([track(3002, 2), track(3001, 1)]),
      ),
    );
    const store = createTestStore();
    await store
      .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
      .unwrap();
    const liveEntries = () =>
      flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(store.getState()).data;
    const liveBefore = structuredClone(liveEntries());
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />, { store });
    await screen.findByText("la paradoja 3001");

    fireEvent.click(moveButtons()[1]);

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(bodies).toEqual([{ entry_id: 3001, new_position: 2 }]);
    expect(liveEntries()).toEqual(liveBefore);
    expect(
      Object.values(store.getState().flowsheetApi.mutations).filter(
        (m) => m?.endpointName === "switchEntries",
      ),
    ).toEqual([]);
  });

  it("removes through the past-show route, not the live mutation", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    const deleted = vi.fn();
    server.use(
      http.delete(`${TEST_BACKEND_URL}/flowsheet`, async ({ request }) => {
        deleted(await request.json());
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const store = createTestStore();
    renderWithProviders(<ShowView showId={SHOW_ID} />, { store });
    await screen.findByText("la paradoja 3001");

    fireEvent.click(screen.getByTestId("flowsheet-remove-3001"));

    await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
    expect(
      Object.values(store.getState().flowsheetApi.mutations).filter(
        (m) => m?.endpointName === "removeFromFlowsheet",
      ),
    ).toEqual([]);
  });

  it("offers remove on a message row of an ended show", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist({
      ...ended,
      entries: [
        { ...track(3003, 3), entry_type: "talkset", message: "talkset" } as never,
        ...ended.entries,
      ],
    });
    renderWithProviders(<ShowView showId={SHOW_ID} />);
    await screen.findByText("la paradoja 3001");

    expect(screen.getByTestId("flowsheet-remove-3003")).toBeInTheDocument();
  });

  it.each([
    ["a closed_show 403", 403, { code: "closed_show", message: "Show closed" }, CLOSED_SHOW_SENTENCE],
    ["a 400", 400, { message: "DJ not a member of show" }, NOT_ON_SHOW_SENTENCE],
  ])("words a refused move with %s as one sentence", async (_name, status, payload, sentence) => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, () =>
        HttpResponse.json(payload, { status }),
      ),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);
    await screen.findByText("la paradoja 3001");

    fireEvent.click(moveButtons()[1]);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(sentence));
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
