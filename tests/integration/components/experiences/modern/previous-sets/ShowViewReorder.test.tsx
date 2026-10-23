import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
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

// jsdom cannot drag, so the group and its items hand their drag callbacks to
// the test: a drag is `onReorder` with the new order, then the item's `onDragEnd`.
const drag = vi.hoisted(() => ({
  onReorder: null as null | ((next: unknown[]) => void),
  endById: new Map<number, () => void>(),
  startById: new Map<number, () => void>(),
}));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    Reorder: {
      Group: ({ children, onReorder }: any) => {
        drag.onReorder = onReorder;
        return <tbody>{children}</tbody>;
      },
      Item: ({ children, value, onDragEnd, onDragStart, id, className }: any) => {
        drag.endById.set(value.id, () => onDragEnd());
        drag.startById.set(value.id, () => onDragStart());
        return (
          <tr id={id} className={className} data-testid={`flowsheet-entry-${value.id}`}>
            {children}
          </tr>
        );
      },
    },
  };
});

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

const grips = (container: HTMLElement) => container.querySelectorAll(".drag-grip");

// Swaps the two rows the way a drop would, then ends the drag on the dragged one.
const dragFirstBelowSecond = () => {
  act(() => drag.onReorder!([{ id: 3002 }, { id: 3001 }]));
  act(() => drag.endById.get(3001)!());
};

beforeEach(() => {
  playlistGets = 0;
  toastError.mockClear();
  drag.endById.clear();
  drag.startById.clear();
});

describe("ShowView reorder", () => {
  it.each([
    ["music director", Authorization.MD, ended, true],
    ["station manager", Authorization.SM, ended, true],
    ["DJ", Authorization.DJ, ended, false],
    ["DJ on the air", Authorization.DJ, onAir, true],
    ["DJ not on the air show", Authorization.DJ, show({ end_time: null }), false],
    ["music director not on the air show", Authorization.MD, show({ end_time: null }), true],
  ])("a %s sees drag grips: %s", async (_role, authority, body, offered) => {
    mockAuth.authority = authority;
    servePlaylist(body);
    const { container } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findAllByText("la paradoja 3001");
    expect(grips(container).length > 0).toBe(offered);
  });

  it("sends the move to play-order, refetches the show, and leaves the live entries cache alone", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    // The live flowsheet holds the same rows, so a stray live switchEntries
    // would have something to move.
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
    expect(liveBefore?.pages.flat().length).toBe(2);

    const bodies: unknown[] = [];
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />, { store });
    await screen.findAllByText("la paradoja 3001");

    dragFirstBelowSecond();

    await waitFor(() => expect(playlistGets).toBe(2));
    // Exactly one write: the live switchEntries hits the same route, so a
    // second one would show up here.
    expect(bodies).toEqual([{ entry_id: 3001, new_position: 2 }]);
    expect(liveEntries()).toEqual(liveBefore);
    expect(
      Object.values(store.getState().flowsheetApi.mutations).filter(
        (m) => m?.endpointName === "switchEntries",
      ),
    ).toEqual([]);
  });

  it("computes the drop target from the order frozen at drag start, not a mid-drag refetch", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    let body: unknown;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const store = createTestStore();
    renderWithProviders(<ShowView showId={SHOW_ID} />, { store });
    await screen.findAllByText("la paradoja 3001");

    act(() => drag.startById.get(3001)!());
    act(() => drag.onReorder!([{ id: 3002 }, { id: 3001 }]));

    // A refetch lands mid-drag with the second row renumbered.
    const renumbered = show({ end_time: ended.end_time });
    renumbered.entries = [track(3002, 9), track(3001, 1)];
    servePlaylist(renumbered);
    act(() => {
      store.dispatch(
        showPlaylistApi.util.invalidateTags([{ type: "ShowPlaylist", id: SHOW_ID }]),
      );
    });
    await waitFor(() => expect(playlistGets).toBe(2));

    act(() => drag.endById.get(3001)!());

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({ entry_id: 3001, new_position: 2 });
  });

  it.each([
    ["ends where it began", () => act(() => drag.endById.get(3001)!())],
    [
      "ends after a reorder that settles back on the original order",
      () => {
        act(() => drag.onReorder!([{ id: 3002 }, { id: 3001 }]));
        act(() => drag.onReorder!([{ id: 3001 }, { id: 3002 }]));
        act(() => drag.endById.get(3001)!());
      },
    ],
  ])("shows a mid-drag refetch once a drag that %s", async (_name, endDrag) => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    const store = createTestStore();
    renderWithProviders(<ShowView showId={SHOW_ID} />, { store });
    await screen.findAllByText("la paradoja 3001");

    act(() => drag.startById.get(3001)!());

    const refetched = show({ end_time: ended.end_time });
    refetched.entries = [track(3003, 3), track(3002, 2), track(3001, 1)];
    servePlaylist(refetched);
    act(() => {
      store.dispatch(
        showPlaylistApi.util.invalidateTags([{ type: "ShowPlaylist", id: SHOW_ID }]),
      );
    });
    await waitFor(() => expect(playlistGets).toBe(2));

    endDrag();

    expect(await screen.findAllByText("la paradoja 3003")).not.toHaveLength(0);
  });

  it("sends nothing when a drag ends where it began", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    const sent = vi.fn();
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, () => {
        sent();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);
    await screen.findAllByText("la paradoja 3001");

    act(() => drag.endById.get(3001)!());

    expect(sent).not.toHaveBeenCalled();
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
    await screen.findAllByText("la paradoja 3001");

    dragFirstBelowSecond();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(sentence));
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("does not word a 403 without a code as the closed-show sentence", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ended);
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );
    renderWithProviders(<ShowView showId={SHOW_ID} />);
    await screen.findAllByText("la paradoja 3001");

    dragFirstBelowSecond();

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(toastError).not.toHaveBeenCalledWith(CLOSED_SHOW_SENTENCE);
  });
});
