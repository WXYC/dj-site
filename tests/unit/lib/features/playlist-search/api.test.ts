import { describe, it, expect } from "vitest";
import { describeApi } from "@/tests/helpers";
import {
  playlistSearchApi,
  isCursorPaginated,
} from "@/lib/features/playlist-search/api";

describeApi(playlistSearchApi, {
  queries: ["searchPlaylists"],
  reducerPath: "playlistSearchApi",
});

describe("playlist search pagination mode", () => {
  // Which sorts the backend can address by cursor. Asserted per sort rather
  // than as "not date", so adding a sort to the dropdown without deciding its
  // pagination mode fails here instead of silently inheriting offset.
  it.each([
    ["date", true],
    ["artist", false],
    ["song", false],
    ["dj", false],
  ] as const)("sort=%s is cursor-paginated: %s", (sort, cursorPaginated) => {
    expect(isCursorPaginated(sort)).toBe(cursorPaginated);
  });
});
