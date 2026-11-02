import { describe, expect, it } from "vitest";
import type { RotationBinColors } from "@/lib/features/experiences/modern/tokens/roles";
import { rotationBinSurfaceStyle } from "@/src/utilities/modern/rotationBinColors";

const TOKENS: RotationBinColors = {
  bg: "bg",
  bgHover: "bgHover",
  bgSelected: "bgSelected",
  text: "text",
  textSelected: "textSelected",
  border: "border",
};

describe("rotationBinSurfaceStyle", () => {
  it("reads the unselected surface from the bin's tokens", () => {
    expect(rotationBinSurfaceStyle(TOKENS, false)).toEqual({
      backgroundColor: "bg",
      color: "text",
      borderColor: "border",
      hoverBackgroundColor: "bgHover",
    });
  });

  it("reads the selected surface, with a transparent border", () => {
    expect(rotationBinSurfaceStyle(TOKENS, true)).toEqual({
      backgroundColor: "bgSelected",
      color: "textSelected",
      borderColor: "transparent",
      hoverBackgroundColor: "bgSelected",
    });
  });
});
