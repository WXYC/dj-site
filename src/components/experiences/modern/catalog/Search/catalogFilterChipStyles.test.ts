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

  it("uses catalog result format colors", () => {
    expect(getFormatFilterChipProps("Vinyl")).toEqual({
      color: "primary",
      variant: "soft",
    });
    expect(getFormatFilterChipProps("cd")).toEqual({
      color: "warning",
      variant: "soft",
    });
  });

  it("styles exclusives tag with WXYC purple", () => {
    const props = getTagFilterChipProps("exclusives");
    expect(props.variant).toBe("soft");
    expect(props.sx).toMatchObject({
      bgcolor: "#7B2D8E",
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
