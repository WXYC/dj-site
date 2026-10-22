import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
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
      Item: ({ children, value, onDragEnd, id, className }: any) => {
        drag.endById.set(value.id, () => onDragEnd());
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
});

describe("ShowView reorder", () => {
  it.each([
    ["music director", Authorization.MD, ended, true],
    ["station manager", Authorization.SM, ended, true],
    ["DJ", Authorization.DJ, ended, false],
    ["DJ on the air", Authorization.DJ, onAir, true],
    ["music director not on the air show", Authorization.MD, show({ end_time: null }), false],
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
    let body: unknown;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/play-order`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { store } = renderWithProviders(<ShowView showId={SHOW_ID} />);
    await screen.findAllByText("la paradoja 3001");

    dragFirstBelowSecond();

    await waitFor(() => expect(playlistGets).toBe(2));
    expect(body).toEqual({ entry_id: 3001, new_position: 2 });
    expect(Object.keys(store.getState().flowsheetApi.queries)).toEqual([]);
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
