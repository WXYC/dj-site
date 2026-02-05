import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock next/font/google and next/font/local before importing the themes
vi.mock("next/font/google", () => ({
  Kanit: () => ({
    style: {
      fontFamily: "Kanit, sans-serif",
    },
  }),
}));

vi.mock("next/font/local", () => ({
  default: () => ({
    style: {
      fontFamily: "Minbus, sans-serif",
    },
  }),
}));

// Import after mocking
import { classicTheme } from "@/lib/features/experiences/classic/theme";
import { modernTheme } from "@/lib/features/experiences/modern/theme";
import { baseTheme } from "@/lib/features/experiences/shared/base-theme";

describe("experience themes", () => {
  describe("baseTheme", () => {
    it("should have wxyc as css variable prefix", () => {
      expect(baseTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should have JoyTooltip component overrides", () => {
      expect(baseTheme.components?.JoyTooltip).toBeDefined();
    });

    it("should set tooltip zIndex to 10000", () => {
      expect(
        baseTheme.components?.JoyTooltip?.styleOverrides?.root
      ).toBeDefined();
      const rootOverrides = baseTheme.components?.JoyTooltip?.styleOverrides
        ?.root as { zIndex: number };
      expect(rootOverrides.zIndex).toBe(10000);
    });

    it("should be a valid MUI Joy theme object", () => {
      expect(baseTheme).toHaveProperty("cssVarPrefix");
      expect(baseTheme).toHaveProperty("components");
    });
  });

  describe("classicTheme", () => {
    it("should have wxyc as css variable prefix", () => {
      expect(classicTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should have JoyTooltip component overrides", () => {
      expect(classicTheme.components?.JoyTooltip).toBeDefined();
    });

    it("should set tooltip zIndex to 10000", () => {
      const rootOverrides = classicTheme.components?.JoyTooltip?.styleOverrides
        ?.root as { zIndex: number };
      expect(rootOverrides.zIndex).toBe(10000);
    });

    it("should use Arial font family for display", () => {
      expect(classicTheme.fontFamily?.display).toBe(
        "Arial, Helvetica, sans-serif"
      );
    });

    it("should use Arial font family for body", () => {
      expect(classicTheme.fontFamily?.body).toBe(
        "Arial, Helvetica, sans-serif"
      );
    });

    it("should have h1 typography configured", () => {
      expect(classicTheme.typography?.h1).toBeDefined();
    });

    it("should have h2 typography configured", () => {
      expect(classicTheme.typography?.h2).toBeDefined();
    });

    it("should have h3 typography configured", () => {
      expect(classicTheme.typography?.h3).toBeDefined();
    });

    it("should have h4 typography configured", () => {
      expect(classicTheme.typography?.h4).toBeDefined();
    });

    it("should use Verdana for heading font family", () => {
      const h1 = classicTheme.typography?.h1 as { fontFamily: string };
      expect(h1.fontFamily).toBe(
        "Verdana, Geneva, Arial, Helvetica, sans-serif"
      );
    });

    it("should have bold headings", () => {
      const h1 = classicTheme.typography?.h1 as { fontWeight: string };
      expect(h1.fontWeight).toBe("bold");
    });

    it("should have consistent heading font across all levels", () => {
      const h1Font = (classicTheme.typography?.h1 as { fontFamily: string })
        .fontFamily;
      const h2Font = (classicTheme.typography?.h2 as { fontFamily: string })
        .fontFamily;
      const h3Font = (classicTheme.typography?.h3 as { fontFamily: string })
        .fontFamily;
      const h4Font = (classicTheme.typography?.h4 as { fontFamily: string })
        .fontFamily;

      expect(h1Font).toBe(h2Font);
      expect(h2Font).toBe(h3Font);
      expect(h3Font).toBe(h4Font);
    });

    it("should have consistent heading weight across all levels", () => {
      const h1Weight = (classicTheme.typography?.h1 as { fontWeight: string })
        .fontWeight;
      const h2Weight = (classicTheme.typography?.h2 as { fontWeight: string })
        .fontWeight;
      const h3Weight = (classicTheme.typography?.h3 as { fontWeight: string })
        .fontWeight;
      const h4Weight = (classicTheme.typography?.h4 as { fontWeight: string })
        .fontWeight;

      expect(h1Weight).toBe("bold");
      expect(h2Weight).toBe("bold");
      expect(h3Weight).toBe("bold");
      expect(h4Weight).toBe("bold");
    });

    it("should be a valid MUI Joy theme object", () => {
      expect(classicTheme).toHaveProperty("cssVarPrefix");
      expect(classicTheme).toHaveProperty("components");
      expect(classicTheme).toHaveProperty("fontFamily");
      expect(classicTheme).toHaveProperty("typography");
    });
  });

  describe("modernTheme", () => {
    it("should have wxyc as css variable prefix", () => {
      expect(modernTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should have JoyTooltip component overrides", () => {
      expect(modernTheme.components?.JoyTooltip).toBeDefined();
    });

    it("should set tooltip zIndex to 10000", () => {
      const rootOverrides = modernTheme.components?.JoyTooltip?.styleOverrides
        ?.root as { zIndex: number };
      expect(rootOverrides.zIndex).toBe(10000);
    });

    it("should have display font family configured", () => {
      expect(modernTheme.fontFamily?.display).toBeDefined();
    });

    it("should have body font family configured", () => {
      expect(modernTheme.fontFamily?.body).toBeDefined();
    });

    it("should have h1 typography with font size", () => {
      const h1 = modernTheme.typography?.h1 as { fontSize: string };
      expect(h1.fontSize).toBe("4.5rem");
    });

    it("should have h2 typography with font size", () => {
      const h2 = modernTheme.typography?.h2 as { fontSize: string };
      expect(h2.fontSize).toBe("3.75rem");
    });

    it("should have h3 typography with font size", () => {
      const h3 = modernTheme.typography?.h3 as { fontSize: string };
      expect(h3.fontSize).toBe("3rem");
    });

    it("should have h4 typography with font size", () => {
      const h4 = modernTheme.typography?.h4 as { fontSize: string };
      expect(h4.fontSize).toBe("2.125rem");
    });

    it("should have heading font weights set to 100", () => {
      const h1Weight = (modernTheme.typography?.h1 as { fontWeight: string })
        .fontWeight;
      const h2Weight = (modernTheme.typography?.h2 as { fontWeight: string })
        .fontWeight;
      const h3Weight = (modernTheme.typography?.h3 as { fontWeight: string })
        .fontWeight;
      const h4Weight = (modernTheme.typography?.h4 as { fontWeight: string })
        .fontWeight;

      expect(h1Weight).toBe("100");
      expect(h2Weight).toBe("100");
      expect(h3Weight).toBe("100");
      expect(h4Weight).toBe("100");
    });

    it("should have body-xxs typography variant", () => {
      const bodyXxs = modernTheme.typography?.["body-xxs"] as {
        fontSize: string;
      };
      expect(bodyXxs).toBeDefined();
      expect(bodyXxs.fontSize).toBe("0.6rem");
    });

    it("should have light color scheme configured", () => {
      expect(modernTheme.colorSchemes?.light).toBeDefined();
    });

    it("should have dark color scheme configured", () => {
      expect(modernTheme.colorSchemes?.dark).toBeDefined();
    });

    it("should have primary palette in light color scheme", () => {
      expect(modernTheme.colorSchemes?.light?.palette?.primary).toBeDefined();
    });

    it("should have primary palette in dark color scheme", () => {
      expect(modernTheme.colorSchemes?.dark?.palette?.primary).toBeDefined();
    });

    it("should have success palette in light color scheme", () => {
      expect(modernTheme.colorSchemes?.light?.palette?.success).toBeDefined();
    });

    it("should have success palette in dark color scheme", () => {
      expect(modernTheme.colorSchemes?.dark?.palette?.success).toBeDefined();
    });

    it("should have warning palette in light color scheme", () => {
      expect(modernTheme.colorSchemes?.light?.palette?.warning).toBeDefined();
    });

    it("should have danger palette in light color scheme", () => {
      expect(modernTheme.colorSchemes?.light?.palette?.danger).toBeDefined();
    });

    it("should have danger palette in dark color scheme", () => {
      expect(modernTheme.colorSchemes?.dark?.palette?.danger).toBeDefined();
    });

    it("should have complete primary palette with all shades (50-900)", () => {
      const primaryLight = modernTheme.colorSchemes?.light?.palette
        ?.primary as Record<string, string>;
      const expectedShades = [
        "50",
        "100",
        "200",
        "300",
        "400",
        "500",
        "600",
        "700",
        "800",
        "900",
      ];

      expectedShades.forEach((shade) => {
        expect(primaryLight[shade]).toBeDefined();
      });
    });

    it("should have string color values in primary palette", () => {
      const primaryLight = modernTheme.colorSchemes?.light?.palette
        ?.primary as Record<string, string>;

      // MUI Joy themes convert colors to various formats (CSS vars, RGB, hex)
      // Just verify that each value is a non-empty string
      Object.values(primaryLight).forEach((color) => {
        expect(typeof color).toBe("string");
        expect(color.length).toBeGreaterThan(0);
      });
    });

    it("should be a valid MUI Joy theme object", () => {
      expect(modernTheme).toHaveProperty("cssVarPrefix");
      expect(modernTheme).toHaveProperty("components");
      expect(modernTheme).toHaveProperty("fontFamily");
      expect(modernTheme).toHaveProperty("typography");
      expect(modernTheme).toHaveProperty("colorSchemes");
    });
  });

  describe("theme consistency", () => {
    it("should have consistent cssVarPrefix across all themes", () => {
      expect(baseTheme.cssVarPrefix).toBe(classicTheme.cssVarPrefix);
      expect(classicTheme.cssVarPrefix).toBe(modernTheme.cssVarPrefix);
    });

    it("should have JoyTooltip overrides in all themes", () => {
      expect(baseTheme.components?.JoyTooltip).toBeDefined();
      expect(classicTheme.components?.JoyTooltip).toBeDefined();
      expect(modernTheme.components?.JoyTooltip).toBeDefined();
    });

    it("should have consistent tooltip zIndex across all themes", () => {
      const baseZIndex = (
        baseTheme.components?.JoyTooltip?.styleOverrides?.root as {
          zIndex: number;
        }
      ).zIndex;
      const classicZIndex = (
        classicTheme.components?.JoyTooltip?.styleOverrides?.root as {
          zIndex: number;
        }
      ).zIndex;
      const modernZIndex = (
        modernTheme.components?.JoyTooltip?.styleOverrides?.root as {
          zIndex: number;
        }
      ).zIndex;

      expect(baseZIndex).toBe(10000);
      expect(classicZIndex).toBe(10000);
      expect(modernZIndex).toBe(10000);
    });
  });

  describe("theme differences", () => {
    it("classic and modern should have different display fonts", () => {
      expect(classicTheme.fontFamily?.display).not.toBe(
        modernTheme.fontFamily?.display
      );
    });

    it("classic and modern should have different heading font weights", () => {
      const classicH1Weight = (
        classicTheme.typography?.h1 as { fontWeight: string }
      ).fontWeight;
      const modernH1Weight = (
        modernTheme.typography?.h1 as { fontWeight: string }
      ).fontWeight;

      expect(classicH1Weight).toBe("bold");
      expect(modernH1Weight).toBe("100");
    });

    it("modern should have color schemes while classic may not", () => {
      expect(modernTheme.colorSchemes?.light).toBeDefined();
      expect(modernTheme.colorSchemes?.dark).toBeDefined();
    });

    it("modern should have body-xxs variant that classic does not", () => {
      expect(modernTheme.typography?.["body-xxs"]).toBeDefined();
      expect(classicTheme.typography?.["body-xxs"]).toBeUndefined();
    });
  });
});
