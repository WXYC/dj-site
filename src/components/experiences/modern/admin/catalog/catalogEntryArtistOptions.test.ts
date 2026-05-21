import { describe, expect, it } from "vitest";
import {
  appendCreatableArtistOption,
  defaultLettersFromName,
  getArtistOptionLabel,
  toExistingOption,
} from "./catalogEntryArtistOptions";

describe("catalogEntryArtistOptions", () => {
  it("appends Add option when input is not an exact match", () => {
    const options = [
      toExistingOption({
        id: 1,
        artist_name: "Radiohead",
        code_letters: "RA",
        code_number: 5,
      }),
    ];
    const filtered = appendCreatableArtistOption(options, "New Band");
    expect(filtered.some((o) => o.type === "create")).toBe(true);
    const create = filtered.find((o) => o.type === "create");
    expect(create).toMatchObject({ type: "create", inputValue: "New Band" });
  });

  it("does not append Add option for exact name match", () => {
    const options = [
      toExistingOption({
        id: 1,
        artist_name: "Radiohead",
        code_letters: "RA",
        code_number: 5,
      }),
    ];
    const filtered = appendCreatableArtistOption(options, "radiohead");
    expect(filtered.some((o) => o.type === "create")).toBe(false);
  });

  it("labels create option with quoted name", () => {
    expect(
      getArtistOptionLabel({ type: "create", inputValue: "My Band" })
    ).toBe('Add "My Band"');
  });

  it("derives default code letters from artist name", () => {
    expect(defaultLettersFromName("Built to Spill")).toBe("BU");
    expect(defaultLettersFromName("A")).toBe("");
  });
});
