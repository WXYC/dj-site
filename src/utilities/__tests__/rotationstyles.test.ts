import { describe, it, expect } from "vitest";
import {
  RotationStyles,
  getStyleForRotation,
} from "@/src/utilities/modern/rotationstyles";
import { Rotation } from "@/lib/features/rotation/types";

describe("rotationstyles", () => {
  describe("RotationStyles constant", () => {
    it("should map Heavy rotation to primary color", () => {
      expect(RotationStyles.H).toBe("primary");
    });

    it("should map Medium rotation to neutral color", () => {
      expect(RotationStyles.M).toBe("neutral");
    });

    it("should map Light rotation to success color", () => {
      expect(RotationStyles.L).toBe("success");
    });

    it("should map S rotation to warning color", () => {
      expect(RotationStyles.S).toBe("warning");
    });

    it("should have mappings for all Rotation enum values", () => {
      const rotationValues = Object.values(Rotation);
      rotationValues.forEach((rotation) => {
        expect(RotationStyles[rotation]).toBeDefined();
      });
    });

    it("should only contain valid ColorPaletteProp values", () => {
      const validColors = ["primary", "neutral", "success", "warning", "danger"];
      Object.values(RotationStyles).forEach((color) => {
        expect(validColors).toContain(color);
      });
    });
  });

  describe("getStyleForRotation", () => {
    it("should return primary for Heavy rotation", () => {
      expect(getStyleForRotation(Rotation.H)).toBe("primary");
    });

    it("should return neutral for Medium rotation", () => {
      expect(getStyleForRotation(Rotation.M)).toBe("neutral");
    });

    it("should return success for Light rotation", () => {
      expect(getStyleForRotation(Rotation.L)).toBe("success");
    });

    it("should return warning for S rotation", () => {
      expect(getStyleForRotation(Rotation.S)).toBe("warning");
    });

    it.each([
      [Rotation.H, "primary"],
      [Rotation.M, "neutral"],
      [Rotation.L, "success"],
      [Rotation.S, "warning"],
    ] as const)(
      "should return %s for rotation %s",
      (rotation, expectedColor) => {
        expect(getStyleForRotation(rotation)).toBe(expectedColor);
      }
    );

    it("should return undefined for invalid rotation", () => {
      // Test with an invalid rotation value (cast to bypass TypeScript)
      const invalidRotation = "X" as Rotation;
      expect(getStyleForRotation(invalidRotation)).toBeUndefined();
    });

    it("should return undefined for empty string as rotation", () => {
      const emptyRotation = "" as Rotation;
      expect(getStyleForRotation(emptyRotation)).toBeUndefined();
    });

    it("should handle string rotation values (enum string values)", () => {
      // The Rotation enum has string values like "H", "M", "L", "S"
      expect(getStyleForRotation("H" as Rotation)).toBe("primary");
      expect(getStyleForRotation("M" as Rotation)).toBe("neutral");
      expect(getStyleForRotation("L" as Rotation)).toBe("success");
      expect(getStyleForRotation("S" as Rotation)).toBe("warning");
    });
  });

  describe("consistency between RotationStyles and getStyleForRotation", () => {
    it("should return the same value from both RotationStyles and getStyleForRotation", () => {
      Object.values(Rotation).forEach((rotation) => {
        expect(getStyleForRotation(rotation)).toBe(RotationStyles[rotation]);
      });
    });
  });
});
