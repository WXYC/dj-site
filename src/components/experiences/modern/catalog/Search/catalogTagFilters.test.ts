import { describe, it, expect } from "vitest";
import {
  catalogTagsToQueryFlags,
  getCatalogTagLabel,
  isCatalogRotationTag,
} from "./catalogTagFilters";

describe("catalogTagsToQueryFlags", () => {
  it("returns false on_streaming when exclusives is selected", () => {
    expect(catalogTagsToQueryFlags(["exclusives"])).toEqual({
      on_streaming: false,
      missing: undefined,
      rotation_bins: undefined,
    });
  });

  it("returns missing true when missing is selected", () => {
    expect(catalogTagsToQueryFlags(["missing"])).toEqual({
      on_streaming: undefined,
      missing: true,
      rotation_bins: undefined,
    });
  });

  it("returns rotation_bins when rotation tags are selected", () => {
    expect(catalogTagsToQueryFlags(["H", "M"])).toEqual({
      on_streaming: undefined,
      missing: undefined,
      rotation_bins: ["H", "M"],
    });
  });

  it("returns undefined flags when no tags are selected", () => {
    expect(catalogTagsToQueryFlags([])).toEqual({
      on_streaming: undefined,
      missing: undefined,
      rotation_bins: undefined,
    });
  });

  it("supports exclusives, missing, and rotation together", () => {
    expect(catalogTagsToQueryFlags(["exclusives", "missing", "H"])).toEqual({
      on_streaming: false,
      missing: true,
      rotation_bins: ["H"],
    });
  });
});

describe("getCatalogTagLabel", () => {
  it("labels rotation bins for the autocomplete", () => {
    expect(getCatalogTagLabel("H")).toBe("Heavy Rotation");
    expect(getCatalogTagLabel("N")).toBe("New Rotation");
  });

  it("passes through status tag ids", () => {
    expect(getCatalogTagLabel("exclusives")).toBe("exclusives");
  });
});

describe("isCatalogRotationTag", () => {
  it("recognizes rotation bin codes only", () => {
    expect(isCatalogRotationTag("M")).toBe(true);
    expect(isCatalogRotationTag("exclusives")).toBe(false);
  });
});
