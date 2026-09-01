import { describe, expect, it } from "vitest";
import { Rotation } from "@/lib/features/rotation/types";
import type { RotationBinTokens } from "@/lib/features/experiences/modern/themes/types";
import {
  ROTATION_BIN_PALETTE_SLOT,
  rotationBinSurfaceStyle,
} from "@/src/utilities/modern/rotationBinColors";

const TOKENS: RotationBinTokens = {
  bg: "bg",
  bgHover: "bgHover",
  bgSelected: "bgSelected",
  text: "text",
  textSelected: "textSelected",
  border: "border",
};

describe("ROTATION_BIN_PALETTE_SLOT", () => {
  it("maps every bin to its theme rotation palette slot", () => {
    expect(ROTATION_BIN_PALETTE_SLOT).toEqual({
      [Rotation.H]: "heavy",
      [Rotation.M]: "medium",
      [Rotation.L]: "light",
      [Rotation.S]: "singles",
    });
  });
});

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
