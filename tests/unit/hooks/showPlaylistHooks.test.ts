import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { SpecialtyShowRef } from "@wxyc/shared";
import type { ShowPlaylistWire } from "@/lib/features/show-playlist/types";

const queryState: {
  data: ShowPlaylistWire | undefined;
  isFetching: boolean;
  error: unknown;
} = { data: undefined, isFetching: false, error: undefined };

const mockUpdateShowEntry = vi.fn();
vi.mock("@/lib/features/show-playlist/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/features/show-playlist/api")>()),
  useGetShowPlaylistQuery: () => queryState,
  useUpdateShowEntryMutation: () => [mockUpdateShowEntry],
  useRemoveShowEntryMutation: () => [vi.fn()],
  useReorderShowEntryMutation: () => [vi.fn()],
}));

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn() },
}));

import { usePastShowEntryActions, useShowPlaylist } from "@/src/hooks/showPlaylistHooks";

const wire = (over: Partial<ShowPlaylistWire> = {}): ShowPlaylistWire => ({
  id: 900001,
  show_name: null,
  specialty_show_name: "",
  start_time: "2026-09-06T22:00:00.000Z",
  end_time: "2026-09-07T01:00:00.000Z",
  show_djs: [],
  dj_name_override: null,
  legacy_dj_name: "DJ Chowder",
  previous_show_id: 900000,
  next_show_id: 900002,
  entries: [],
  ...over,
});

const specialty: SpecialtyShowRef = {
  id: 7,
  slug: "sunset-soundtrack",
  name: "Sunset Soundtrack",
  short_name: "SST",
  logs_playcuts: true,
  accent_color: "#7a3b00",
};

const entry = (play_order: number, entry_type: string) => ({
  id: play_order,
  show_id: 900001,
  play_order,
  add_time: "2026-09-06T22:00:00.000Z",
  entry_type,
});

const render = (over: Partial<ShowPlaylistWire> = {}, rest = {}) => {
  Object.assign(queryState, { data: wire(over), isFetching: false, error: undefined }, rest);
  return renderHook(() => useShowPlaylist(900001)).result.current;
};

describe("useShowPlaylist", () => {
  it("titles a tagged show by its program, with the airing's name beneath", () => {
    const show = render({ specialty, show_name: "Blade Runner" });
    expect(show.title).toBe("Sunset Soundtrack");
    expect(show.subtitle).toBe("Blade Runner");
    expect(show.specialty).toEqual(specialty);
  });

  it("drops the subtitle when the airing is named for the program or not at all", () => {
    expect(render({ specialty, show_name: "Sunset Soundtrack" }).subtitle).toBeNull();
    expect(render({ specialty, show_name: null }).subtitle).toBeNull();
  });

  it("keeps the show name, handle, absence chain for an untagged show", () => {
    const show = render({ show_name: "Late Night" });
    expect(show.title).toBe("Late Night");
    expect(show.subtitle).toBeNull();
    expect(show.specialty).toBeNull();
    expect(render({ show_name: null }).title).toBe("DJ Chowder");
  });

  // The route returns entries newest-first. A set has to read in the order it
  // aired, or the show opens with its sign-off.
  it("orders entries as they aired, not as the route returns them", () => {
    const show = render({
      entries: [
        entry(10, "show_end"),
        entry(3, "track"),
        entry(1, "show_start"),
      ] as never,
    });

    expect(show.entries.map((e) => e.play_order)).toEqual([1, 3, 10]);
  });

  // show_djs is empty for every show imported from tubafrenzy, which is most
  // of the archive; reading it alone leaves those sets crediting nobody.
  it("falls back to the legacy handle when the show has no DJ membership", () => {
    expect(render().djName).toBe("DJ Chowder");
  });

  it("prefers a per-show override over both", () => {
    const show = render({
      dj_name_override: "DJ Marmalade",
      show_djs: [{ id: "u1", dj_name: "DJ Someone" }],
    });
    expect(show.djName).toBe("DJ Marmalade");
  });

  it("draws a show whose sign-off was never recorded as open-ended", () => {
    // A null end_time is permanent, not "still on the air".
    expect(render({ end_time: null }).timeRange).toContain("no sign-off recorded");
  });

  it("derives the week link from the show, not from the caller", () => {
    // 2026-09-06 is a Sunday at the station, so it is its own week start.
    expect(render().weekParam).toBe("2026-09-06");
  });

  it("carries the neighbouring shows the route resolved", () => {
    const show = render();
    expect(show.previousShowId).toBe(900000);
    expect(show.nextShowId).toBe(900002);
  });

  it("reports no neighbour at the archive's ends", () => {
    expect(render({ previous_show_id: null }).previousShowId).toBeNull();
    expect(render({ next_show_id: null }).nextShowId).toBeNull();
  });

  // A null end_time is an unrecorded sign-off, not a show still on the air,
  // and the archive is full of them. Reading it as liveness and dropping the
  // next show would end the walk at every abandoned set.
  it("keeps the next show for a set whose sign-off was never recorded", () => {
    expect(render({ end_time: null }).nextShowId).toBe(900002);
  });

  it("reports not-found only for a 404", () => {
    expect(render({}, { error: { status: 404 } }).notFound).toBe(true);
    // A soft-failed body yields the empty playlist too; saying the show does
    // not exist because the response failed to parse is a different claim.
    expect(render({}, { error: { status: 500 } }).notFound).toBe(false);
  });
});

describe("usePastShowEntryActions().updateFlowsheet", () => {
  const SENTENCE = "Who's on air isn't turned on yet.";
  const rejectWith = (error: unknown) =>
    mockUpdateShowEntry.mockReturnValueOnce({ unwrap: () => Promise.reject(error) });
  const actions = () => renderHook(() => usePastShowEntryActions(900001)).result.current;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The row words a refused rename itself, by the row. A toast here would say
  // it twice.
  it("returns a refused rename's sentence without toasting it", async () => {
    rejectWith({ expected: true, sentence: SENTENCE });

    await expect(
      actions().updateFlowsheet({ entry_id: 7100, data: { spotlight_name: "Porch Static Duo" } })
    ).resolves.toBe(SENTENCE);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  // Nothing else reads the return value of a song-field edit, so the sentence
  // has to reach the DJ as a toast.
  it("toasts and returns the sentence of a refused song-field edit", async () => {
    rejectWith({ expected: true, sentence: SENTENCE });

    await expect(
      actions().updateFlowsheet({ entry_id: 7100, data: { track_title: "la paradoja" } })
    ).resolves.toBe(SENTENCE);
    expect(mockToastError).toHaveBeenCalledExactlyOnceWith(SENTENCE);
  });

  it("returns nothing and toasts nothing when the global toast already spoke", async () => {
    rejectWith({ status: 500 });

    await expect(
      actions().updateFlowsheet({ entry_id: 7100, data: { spotlight_name: "Porch Static Duo" } })
    ).resolves.toBeUndefined();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("returns nothing for an accepted write", async () => {
    mockUpdateShowEntry.mockReturnValueOnce({ unwrap: () => Promise.resolve({}) });

    await expect(
      actions().updateFlowsheet({ entry_id: 7100, data: { spotlight_name: "Porch Static Duo" } })
    ).resolves.toBeUndefined();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
