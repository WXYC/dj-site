import { describe, it, expect } from "vitest";
import { catalogTagsToQueryFlags } from "./catalogTagFilters";

describe("catalogTagsToQueryFlags", () => {
  it("returns false on_streaming when exclusives is selected", () => {
    expect(catalogTagsToQueryFlags(["exclusives"])).toEqual({
      on_streaming: false,
      missing: undefined,
    });
  });

  it("returns missing true when missing is selected", () => {
    expect(catalogTagsToQueryFlags(["missing"])).toEqual({
      on_streaming: undefined,
      missing: true,
    });
  });

  it("returns undefined flags when no tags are selected", () => {
    expect(catalogTagsToQueryFlags([])).toEqual({
      on_streaming: undefined,
      missing: undefined,
    });
  });

  it("supports exclusives and missing together", () => {
    expect(catalogTagsToQueryFlags(["exclusives", "missing"])).toEqual({
      on_streaming: false,
      missing: true,
    });
  });
});
