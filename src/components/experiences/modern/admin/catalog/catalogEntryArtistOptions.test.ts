import { describe, expect, it } from "vitest";
import {
  defaultLettersFromName,
  findExactArtistMatch,
  getArtistOptionLabel,
  resolveArtistInputCommit,
  toExistingOption,
} from "./catalogEntryArtistOptions";

describe("catalogEntryArtistOptions", () => {
  const radiohead = toExistingOption({
    id: 1,
    artist_name: "Radiohead",
    code_letters: "RA",
    code_number: 5,
  });

  it("labels existing option with artist name", () => {
    expect(getArtistOptionLabel(radiohead)).toBe("Radiohead");
  });

  it("finds exact artist match case-insensitively", () => {
    expect(findExactArtistMatch([radiohead], "radiohead")).toEqual(radiohead);
    expect(findExactArtistMatch([radiohead], "New Band")).toBeNull();
  });

  it("resolveArtistInputCommit returns existing for exact match", () => {
    expect(resolveArtistInputCommit("Radiohead", [radiohead], true)).toEqual({
      kind: "existing",
      artist: {
        id: 1,
        artist_name: "Radiohead",
        code_letters: "RA",
        code_number: 5,
      },
    });
  });

  it("resolveArtistInputCommit returns new when no match and create allowed", () => {
    expect(resolveArtistInputCommit("New Band", [radiohead], true)).toEqual({
      kind: "new",
      name: "New Band",
    });
  });

  it("resolveArtistInputCommit returns noop when no match and create disallowed", () => {
    expect(resolveArtistInputCommit("New Band", [radiohead], false)).toEqual({
      kind: "noop",
    });
  });

  it("resolveArtistInputCommit clears empty input", () => {
    expect(resolveArtistInputCommit("  ", [radiohead], true)).toEqual({
      kind: "clear",
    });
  });

  it("derives default code letters from artist name", () => {
    expect(defaultLettersFromName("Built to Spill")).toBe("BU");
    expect(defaultLettersFromName("A")).toBe("");
  });
});
