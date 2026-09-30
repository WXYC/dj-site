import { describe, it, expect } from "vitest";
import {
  capsulesForSongEntry,
  isExclusive,
  type Capsulable,
} from "@/lib/features/flowsheet/indicators";

describe("isExclusive", () => {
  it.each<[string, boolean, Pick<Capsulable, "on_streaming">]>([
    ["false", true, { on_streaming: false }],
    ["true", false, { on_streaming: true }],
    ["null", false, { on_streaming: null }],
    ["undefined", false, { on_streaming: undefined }],
    ["absent", false, {}],
  ])("on_streaming %s -> %s", (_name, expected, entry) => {
    expect(isExclusive(entry)).toBe(expected);
  });
});

describe("capsulesForSongEntry", () => {
  it("returns no capsules for an entry with no flags set", () => {
    expect(capsulesForSongEntry({})).toEqual([]);
  });

  it("orders capsules ROTATION -> REQUEST -> EXCLUSIVE", () => {
    expect(
      capsulesForSongEntry({
        rotation: "H",
        request_flag: true,
        on_streaming: false,
      })
    ).toEqual([
      { variant: "rotation", label: "ROTATION H" },
      { variant: "request", label: "REQUEST" },
      { variant: "exclusive", label: "EXCLUSIVE" },
    ]);
  });

  it("omits EXCLUSIVE when on_streaming is null (no linked library row)", () => {
    expect(capsulesForSongEntry({ on_streaming: null })).toEqual([]);
  });

  it("includes only the flags that are set", () => {
    expect(capsulesForSongEntry({ request_flag: true })).toEqual([
      { variant: "request", label: "REQUEST" },
    ]);
  });
});
