import { describe, it, expect } from "vitest";
import {
  genreNameToGenreKey,
  getFormatFilterChipProps,
  getGenreFilterChipProps,
  getTagFilterChipProps,
} from "./catalogFilterChipStyles";

describe("catalogFilterChipStyles", () => {
  it("maps genre names case-insensitively", () => {
    expect(genreNameToGenreKey("rock")).toBe("Rock");
    expect(genreNameToGenreKey("JAZZ")).toBe("Jazz");
    expect(genreNameToGenreKey("Not Real")).toBe("Unknown");
  });

  it("uses ArtistAvatar genre palettes", () => {
    expect(getGenreFilterChipProps("Rock")).toEqual({
      color: "primary",
      variant: "solid",
    });
    expect(getGenreFilterChipProps("Jazz")).toEqual({
      color: "warning",
      variant: "solid",
    });
  });

  it("uses dedicated format hues", () => {
    expect(getFormatFilterChipProps("Vinyl")).toEqual({
      color: "formatVinyl",
      variant: "soft",
    });
    expect(getFormatFilterChipProps("cd")).toEqual({
      color: "formatCd",
      variant: "soft",
    });
    expect(getFormatFilterChipProps("mystery")).toEqual({
      color: "neutral",
      variant: "soft",
    });
  });

  it("styles exclusives tag with the WXYC exclusive palette slot", () => {
    const props = getTagFilterChipProps("exclusives");
    expect(props.variant).toBe("soft");
    expect(props.sx).toMatchObject({
      bgcolor: "var(--wxyc-palette-exclusive-solidBg, #7B2D8E)",
      color: "#fff",
    });
    expect(props.color).toBeUndefined();
  });

  it("styles missing tag as neutral outlined (not exclusives purple)", () => {
    expect(getTagFilterChipProps("missing")).toEqual({
      color: "neutral",
      variant: "outlined",
    });
    expect(getTagFilterChipProps("missing").sx).toBeUndefined();
  });
});
