import { describe, it, expect } from "vitest";
import { Rotation } from "@/lib/features/rotation/types";

describe("rotation types", () => {
  describe("Rotation enum", () => {
    it("should have S (Sound) rotation", () => {
      expect(Rotation.S).toBe("S");
    });

    it("should have L (Light) rotation", () => {
      expect(Rotation.L).toBe("L");
    });

    it("should have M (Medium) rotation", () => {
      expect(Rotation.M).toBe("M");
    });

    it("should have H (Heavy) rotation", () => {
      expect(Rotation.H).toBe("H");
    });

    it("should have exactly 4 rotation values", () => {
      const rotationValues = Object.values(Rotation);
      expect(rotationValues).toHaveLength(4);
    });

    it("should allow comparison with string values", () => {
      expect(Rotation.H === "H").toBe(true);
      expect(Rotation.M === "M").toBe(true);
      expect(Rotation.L === "L").toBe(true);
      expect(Rotation.S === "S").toBe(true);
    });
  });
});
