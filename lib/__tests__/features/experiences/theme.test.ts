import { describe, it, expect, vi } from "vitest";

// Mock Next.js font modules before importing themes
vi.mock("next/font/google", () => ({
  Kanit: () => ({
    style: { fontFamily: "Kanit, sans-serif" },
  }),
}));

vi.mock("next/font/local", () => ({
  default: () => ({
    style: { fontFamily: "LocalFont, sans-serif" },
  }),
}));

import { classicTheme } from "@/lib/features/experiences/classic/theme";
import { modernTheme } from "@/lib/features/experiences/modern/theme";

describe("experience themes", () => {
  describe("classicTheme", () => {
    it("should have cssVarPrefix set to 'wxyc'", () => {
      expect(classicTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should have JoyTooltip component override", () => {
      expect(classicTheme.components?.JoyTooltip).toBeDefined();
    });

    it("should have display font family set to Arial", () => {
      expect(classicTheme.fontFamily?.display).toContain("Arial");
    });

    it("should have body font family set to Arial", () => {
      expect(classicTheme.fontFamily?.body).toContain("Arial");
    });

    it("should have h1 typography with Verdana font family", () => {
      const h1 = classicTheme.typography?.h1;
      expect(h1).toBeDefined();
      if (typeof h1 === "object" && h1 !== null) {
        expect((h1 as any).fontFamily).toContain("Verdana");
      }
    });

    it("should have h1 typography with bold font weight", () => {
      const h1 = classicTheme.typography?.h1;
      if (typeof h1 === "object" && h1 !== null) {
        expect((h1 as any).fontWeight).toBe("bold");
      }
    });
  });

  describe("modernTheme", () => {
    it("should have cssVarPrefix set to 'wxyc'", () => {
      expect(modernTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should be defined", () => {
      expect(modernTheme).toBeDefined();
    });

    it("should have components defined", () => {
      expect(modernTheme.components).toBeDefined();
    });

    it("should have typography defined", () => {
      expect(modernTheme.typography).toBeDefined();
    });

    it("should have fontFamily defined", () => {
      expect(modernTheme.fontFamily).toBeDefined();
    });
  });
});
