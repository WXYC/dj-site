import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ShowPlaylistWire } from "@/lib/features/show-playlist/types";

const queryState: {
  data: ShowPlaylistWire | undefined;
  isFetching: boolean;
  error: unknown;
} = { data: undefined, isFetching: false, error: undefined };

vi.mock("@/lib/features/show-playlist/api", () => ({
  useGetShowPlaylistQuery: () => queryState,
}));

import { useShowPlaylist } from "@/src/hooks/showPlaylistHooks";

const wire = (over: Partial<ShowPlaylistWire> = {}): ShowPlaylistWire => ({
  id: 900001,
  show_name: null,
  specialty_show_name: "",
  start_time: "2026-09-06T22:00:00.000Z",
  end_time: "2026-09-07T01:00:00.000Z",
  show_djs: [],
  dj_name_override: null,
  legacy_dj_name: "DJ Chowder",
  entries: [],
  ...over,
});

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

  it("reports not-found only for a 404", () => {
    expect(render({}, { error: { status: 404 } }).notFound).toBe(true);
    // A soft-failed body yields the empty playlist too; saying the show does
    // not exist because the response failed to parse is a different claim.
    expect(render({}, { error: { status: 500 } }).notFound).toBe(false);
  });
});
