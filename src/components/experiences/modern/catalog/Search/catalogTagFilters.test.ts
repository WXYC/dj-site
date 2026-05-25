import { describe, it, expect } from "vitest";
import { catalogTagsToOnStreaming } from "./catalogTagFilters";

describe("catalogTagsToOnStreaming", () => {
  it("returns false when exclusives is selected", () => {
    expect(catalogTagsToOnStreaming(["exclusives"])).toBe(false);
  });

  it("returns undefined when no tags are selected", () => {
    expect(catalogTagsToOnStreaming([])).toBeUndefined();
  });
});
