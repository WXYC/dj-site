import { describe, it, expect } from "vitest";
import { RotationStyles, getStyleForRotation } from "./rotationstyles";

describe("rotationstyles", () => {
  describe("RotationStyles", () => {
    it("should map H rotation to primary color", () => {
      expect(RotationStyles.H).toBe("primary");
    });

    it("should map M rotation to neutral color", () => {
      expect(RotationStyles.M).toBe("neutral");
    });

    it("should map L rotation to success color", () => {
      expect(RotationStyles.L).toBe("success");
    });

    it("should map S rotation to warning color", () => {
      expect(RotationStyles.S).toBe("warning");
    });
  });

  describe("getStyleForRotation", () => {
    it("should return primary for H rotation", () => {
      expect(getStyleForRotation("H")).toBe("primary");
    });

    it("should return neutral for M rotation", () => {
      expect(getStyleForRotation("M")).toBe("neutral");
    });

    it("should return success for L rotation", () => {
      expect(getStyleForRotation("L")).toBe("success");
    });

    it("should return warning for S rotation", () => {
      expect(getStyleForRotation("S")).toBe("warning");
    });

    it("should return undefined for unknown rotation", () => {
      expect(getStyleForRotation("X" as any)).toBeUndefined();
    });
  });
});
