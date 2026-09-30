import { describe, it, expect } from "vitest";
import { capsulesForSongEntry, isExclusive } from "@/lib/features/flowsheet/indicators";

describe("isExclusive", () => {
  it("is true only when on_streaming is explicitly false", () => {
    expect(isExclusive({ on_streaming: false })).toBe(true);
    expect(isExclusive({ on_streaming: true })).toBe(false);
    expect(isExclusive({ on_streaming: null })).toBe(false);
    expect(isExclusive({ on_streaming: undefined })).toBe(false);
    expect(isExclusive({})).toBe(false);
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
