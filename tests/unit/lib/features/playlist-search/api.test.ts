import { describe, it, expect } from "vitest";
import { describeApi } from "@/tests/helpers/api-harness";
import {
  playlistSearchApi,
  isCursorPaginated,
} from "@/lib/features/playlist-search/api";

describeApi(playlistSearchApi, {
  queries: ["searchPlaylists"],
  reducerPath: "playlistSearchApi",
});

describe("playlist search pagination mode", () => {
  // Which way each sort is decided. That a sort *has* a decision is the
  // record's job — being total over the sort union, it fails to compile when a
  // new one arrives undeclared, which no hand-written table here could catch.
  it.each([
    ["date", true],
    ["artist", false],
    ["song", false],
    ["dj", false],
  ] as const)("sort=%s is cursor-paginated: %s", (sort, cursorPaginated) => {
    expect(isCursorPaginated(sort)).toBe(cursorPaginated);
  });
});
