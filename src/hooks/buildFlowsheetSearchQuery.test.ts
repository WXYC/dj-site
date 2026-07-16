import { describe, it, expect } from "vitest";
import { buildFlowsheetSearchQuery } from "./catalogHooks";

describe("buildFlowsheetSearchQuery", () => {
  it("builds an album-only query (the album-first fix)", () => {
    expect(buildFlowsheetSearchQuery("", "Dots and Loops")).toBe(
      "album:Dots and Loops",
    );
  });

  it("builds an artist-only query", () => {
    expect(buildFlowsheetSearchQuery("Stereolab", "")).toBe(
      "artist:Stereolab",
    );
  });

  it("combines artist and album with AND", () => {
    expect(buildFlowsheetSearchQuery("Stereolab", "Dots and Loops")).toBe(
      "artist:Stereolab AND album:Dots and Loops",
    );
  });

  it("is empty when both fields are blank", () => {
    expect(buildFlowsheetSearchQuery("", "")).toBe("");
    expect(buildFlowsheetSearchQuery("   ", "  ")).toBe("");
  });
});
