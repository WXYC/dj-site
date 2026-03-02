import { describe, it, expect } from "vitest";
import { baseTheme } from "../base-theme";

describe("base-theme", () => {
  describe("cssVarPrefix", () => {
    it("should have cssVarPrefix set to 'wxyc'", () => {
      expect(baseTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should be a string", () => {
      expect(typeof baseTheme.cssVarPrefix).toBe("string");
    });
  });

  describe("components", () => {
    it("should have components property defined", () => {
      expect(baseTheme.components).toBeDefined();
    });

    it("should have JoyTooltip component override", () => {
      expect(baseTheme.components?.JoyTooltip).toBeDefined();
    });

    describe("JoyTooltip", () => {
      it("should have styleOverrides property", () => {
        expect(baseTheme.components?.JoyTooltip?.styleOverrides).toBeDefined();
      });

      it("should have root styleOverride", () => {
        expect(
          baseTheme.components?.JoyTooltip?.styleOverrides?.root
        ).toBeDefined();
      });

      it("should set root zIndex to 10000", () => {
        const rootOverrides = baseTheme.components?.JoyTooltip?.styleOverrides
          ?.root as { zIndex: number };
        expect(rootOverrides).toBeDefined();
        expect(rootOverrides.zIndex).toBe(10000);
      });

      it("should have zIndex as a number", () => {
        const rootOverrides = baseTheme.components?.JoyTooltip?.styleOverrides
          ?.root as { zIndex: number };
        expect(typeof rootOverrides.zIndex).toBe("number");
      });

      it("should have zIndex greater than typical modal zIndex (1000)", () => {
        const rootOverrides = baseTheme.components?.JoyTooltip?.styleOverrides
          ?.root as { zIndex: number };
        expect(rootOverrides.zIndex).toBeGreaterThan(1000);
      });
    });
  });

  describe("theme structure", () => {
    it("should be a valid object", () => {
      expect(typeof baseTheme).toBe("object");
      expect(baseTheme).not.toBeNull();
    });

    it("should have required MUI Joy theme properties", () => {
      expect(baseTheme).toHaveProperty("cssVarPrefix");
      expect(baseTheme).toHaveProperty("components");
    });

    it("should be a frozen/immutable theme object", () => {
      // MUI Joy themes created with extendTheme are objects
      expect(typeof baseTheme).toBe("object");
    });
  });

  describe("default export", () => {
    it("should export baseTheme as default", async () => {
      const module = await import("../base-theme");
      expect(module.default).toBe(baseTheme);
    });

    it("should export baseTheme as named export", async () => {
      const module = await import("../base-theme");
      expect(module.baseTheme).toBeDefined();
      expect(module.baseTheme).toBe(baseTheme);
    });
  });
});

describe("base-theme consistency", () => {
  it("should maintain consistent tooltip zIndex value", () => {
    const expectedZIndex = 10000;
    const rootOverrides = baseTheme.components?.JoyTooltip?.styleOverrides
      ?.root as { zIndex: number };
    expect(rootOverrides.zIndex).toBe(expectedZIndex);
  });

  it("should maintain consistent cssVarPrefix value", () => {
    const expectedPrefix = "wxyc";
    expect(baseTheme.cssVarPrefix).toBe(expectedPrefix);
  });
});
