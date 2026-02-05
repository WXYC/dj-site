import { describe, it, expect } from "vitest";
import {
  RotationStyles,
  getStyleForRotation,
} from "@/src/utilities/modern/rotationstyles";
import { Rotation } from "@/lib/features/rotation/types";

describe("rotationstyles", () => {
  it("should have mappings for all Rotation enum values", () => {
    const rotationValues = Object.values(Rotation);
    rotationValues.forEach((rotation) => {
      expect(RotationStyles[rotation]).toBeDefined();
    });
  });

  it("should return the same value from both RotationStyles and getStyleForRotation", () => {
    Object.values(Rotation).forEach((rotation) => {
      expect(getStyleForRotation(rotation)).toBe(RotationStyles[rotation]);
    });
  });

});
