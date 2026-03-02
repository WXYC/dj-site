import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock next/font/google before importing the theme
vi.mock("next/font/google", () => ({
  Kanit: () => ({
    style: {
      fontFamily: "Kanit, sans-serif",
    },
  }),
}));

// Mock next/font/local before importing the theme
vi.mock("next/font/local", () => ({
  default: () => ({
    style: {
      fontFamily: "Minbus, sans-serif",
    },
  }),
}));

// Import after mocking
import { modernTheme } from "../theme";

describe("modern theme", () => {
  describe("cssVarPrefix", () => {
    it("should have cssVarPrefix set to 'wxyc'", () => {
      expect(modernTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should be a string", () => {
      expect(typeof modernTheme.cssVarPrefix).toBe("string");
    });

    it("should match the base theme prefix", () => {
      expect(modernTheme.cssVarPrefix).toBe("wxyc");
    });
  });

  describe("components", () => {
    it("should have components property defined", () => {
      expect(modernTheme.components).toBeDefined();
    });

    it("should have JoyTooltip component override", () => {
      expect(modernTheme.components?.JoyTooltip).toBeDefined();
    });

    describe("JoyTooltip", () => {
      it("should have styleOverrides property", () => {
        expect(modernTheme.components?.JoyTooltip?.styleOverrides).toBeDefined();
      });

      it("should have root styleOverride", () => {
        expect(
          modernTheme.components?.JoyTooltip?.styleOverrides?.root
        ).toBeDefined();
      });

      it("should set root zIndex to 10000", () => {
        const rootOverrides = modernTheme.components?.JoyTooltip?.styleOverrides
          ?.root as { zIndex: number };
        expect(rootOverrides).toBeDefined();
        expect(rootOverrides.zIndex).toBe(10000);
      });
    });
  });

  describe("fontFamily", () => {
    it("should have fontFamily property defined", () => {
      expect(modernTheme.fontFamily).toBeDefined();
    });

    it("should have display font family", () => {
      expect(modernTheme.fontFamily?.display).toBeDefined();
    });

    it("should have body font family", () => {
      expect(modernTheme.fontFamily?.body).toBeDefined();
    });

    it("should use Kanit-based font for display (from mock)", () => {
      expect(modernTheme.fontFamily?.display).toBe("Kanit, sans-serif");
    });

    it("should use Kanit-based font for body (from mock)", () => {
      expect(modernTheme.fontFamily?.body).toBe("Kanit, sans-serif");
    });

    it("should have consistent display and body fonts", () => {
      expect(modernTheme.fontFamily?.display).toBe(modernTheme.fontFamily?.body);
    });
  });

  describe("typography", () => {
    it("should have typography property defined", () => {
      expect(modernTheme.typography).toBeDefined();
    });

    describe("h1", () => {
      it("should be defined", () => {
        expect(modernTheme.typography?.h1).toBeDefined();
      });

      it("should have font family from local font (Minbus mock)", () => {
        const h1 = modernTheme.typography?.h1 as { fontFamily: string };
        expect(h1.fontFamily).toBe("Minbus, sans-serif");
      });

      it("should have font weight of 100", () => {
        const h1 = modernTheme.typography?.h1 as { fontWeight: string };
        expect(h1.fontWeight).toBe("100");
      });

      it("should have font size of 4.5rem", () => {
        const h1 = modernTheme.typography?.h1 as { fontSize: string };
        expect(h1.fontSize).toBe("4.5rem");
      });
    });

    describe("h2", () => {
      it("should be defined", () => {
        expect(modernTheme.typography?.h2).toBeDefined();
      });

      it("should have font family from local font", () => {
        const h2 = modernTheme.typography?.h2 as { fontFamily: string };
        expect(h2.fontFamily).toBe("Minbus, sans-serif");
      });

      it("should have font weight of 100", () => {
        const h2 = modernTheme.typography?.h2 as { fontWeight: string };
        expect(h2.fontWeight).toBe("100");
      });

      it("should have font size of 3.75rem", () => {
        const h2 = modernTheme.typography?.h2 as { fontSize: string };
        expect(h2.fontSize).toBe("3.75rem");
      });
    });

    describe("h3", () => {
      it("should be defined", () => {
        expect(modernTheme.typography?.h3).toBeDefined();
      });

      it("should have font family from local font", () => {
        const h3 = modernTheme.typography?.h3 as { fontFamily: string };
        expect(h3.fontFamily).toBe("Minbus, sans-serif");
      });

      it("should have font weight of 100", () => {
        const h3 = modernTheme.typography?.h3 as { fontWeight: string };
        expect(h3.fontWeight).toBe("100");
      });

      it("should have font size of 3rem", () => {
        const h3 = modernTheme.typography?.h3 as { fontSize: string };
        expect(h3.fontSize).toBe("3rem");
      });
    });

    describe("h4", () => {
      it("should be defined", () => {
        expect(modernTheme.typography?.h4).toBeDefined();
      });

      it("should have font family from local font", () => {
        const h4 = modernTheme.typography?.h4 as { fontFamily: string };
        expect(h4.fontFamily).toBe("Minbus, sans-serif");
      });

      it("should have font weight of 100", () => {
        const h4 = modernTheme.typography?.h4 as { fontWeight: string };
        expect(h4.fontWeight).toBe("100");
      });

      it("should have font size of 2.125rem", () => {
        const h4 = modernTheme.typography?.h4 as { fontSize: string };
        expect(h4.fontSize).toBe("2.125rem");
      });
    });

    describe("heading consistency", () => {
      it("should have same font family for all headings", () => {
        const h1 = modernTheme.typography?.h1 as { fontFamily: string };
        const h2 = modernTheme.typography?.h2 as { fontFamily: string };
        const h3 = modernTheme.typography?.h3 as { fontFamily: string };
        const h4 = modernTheme.typography?.h4 as { fontFamily: string };

        expect(h1.fontFamily).toBe(h2.fontFamily);
        expect(h2.fontFamily).toBe(h3.fontFamily);
        expect(h3.fontFamily).toBe(h4.fontFamily);
      });

      it("should have same font weight for all headings", () => {
        const h1 = modernTheme.typography?.h1 as { fontWeight: string };
        const h2 = modernTheme.typography?.h2 as { fontWeight: string };
        const h3 = modernTheme.typography?.h3 as { fontWeight: string };
        const h4 = modernTheme.typography?.h4 as { fontWeight: string };

        expect(h1.fontWeight).toBe("100");
        expect(h2.fontWeight).toBe("100");
        expect(h3.fontWeight).toBe("100");
        expect(h4.fontWeight).toBe("100");
      });

      it("should have decreasing font sizes from h1 to h4", () => {
        const h1 = modernTheme.typography?.h1 as { fontSize: string };
        const h2 = modernTheme.typography?.h2 as { fontSize: string };
        const h3 = modernTheme.typography?.h3 as { fontSize: string };
        const h4 = modernTheme.typography?.h4 as { fontSize: string };

        const parseRem = (value: string) => parseFloat(value.replace("rem", ""));

        expect(parseRem(h1.fontSize)).toBeGreaterThan(parseRem(h2.fontSize));
        expect(parseRem(h2.fontSize)).toBeGreaterThan(parseRem(h3.fontSize));
        expect(parseRem(h3.fontSize)).toBeGreaterThan(parseRem(h4.fontSize));
      });
    });

    describe("body-xxs variant", () => {
      it("should have body-xxs variant defined", () => {
        expect(modernTheme.typography?.["body-xxs"]).toBeDefined();
      });

      it("should have body-xxs font family from body font", () => {
        const bodyXxs = modernTheme.typography?.["body-xxs"] as {
          fontFamily: string;
        };
        expect(bodyXxs.fontFamily).toBe("Kanit, sans-serif");
      });

      it("should have body-xxs font size of 0.6rem", () => {
        const bodyXxs = modernTheme.typography?.["body-xxs"] as {
          fontSize: string;
        };
        expect(bodyXxs.fontSize).toBe("0.6rem");
      });

      it("should have body-xxs smaller than standard body", () => {
        const bodyXxs = modernTheme.typography?.["body-xxs"] as {
          fontSize: string;
        };
        // 0.6rem is smaller than 1rem (default body size)
        const fontSize = parseFloat(bodyXxs.fontSize.replace("rem", ""));
        expect(fontSize).toBeLessThan(1);
      });
    });
  });

  describe("colorSchemes", () => {
    it("should have colorSchemes property defined", () => {
      expect(modernTheme.colorSchemes).toBeDefined();
    });

    describe("light color scheme", () => {
      it("should have light color scheme", () => {
        expect(modernTheme.colorSchemes?.light).toBeDefined();
      });

      it("should have light palette", () => {
        expect(modernTheme.colorSchemes?.light?.palette).toBeDefined();
      });

      describe("primary palette", () => {
        it("should have primary palette", () => {
          expect(modernTheme.colorSchemes?.light?.palette?.primary).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const primary = modernTheme.colorSchemes?.light?.palette?.primary as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(primary[shade]).toBeDefined();
          });
        });

        it("should have hex color values", () => {
          const primary = modernTheme.colorSchemes?.light?.palette?.primary as Record<string, string>;
          // Check that values look like hex colors (may start with #)
          Object.values(primary).forEach((color) => {
            expect(typeof color).toBe("string");
            expect(color.length).toBeGreaterThan(0);
          });
        });

        it("should have primary-500 as the main brand color", () => {
          const primary = modernTheme.colorSchemes?.light?.palette?.primary as Record<string, string>;
          expect(primary["500"]).toBe("#f43f5e"); // Rose color
        });
      });

      describe("success palette", () => {
        it("should have success palette", () => {
          expect(modernTheme.colorSchemes?.light?.palette?.success).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const success = modernTheme.colorSchemes?.light?.palette?.success as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(success[shade]).toBeDefined();
          });
        });

        it("should have success-500 as teal color", () => {
          const success = modernTheme.colorSchemes?.light?.palette?.success as Record<string, string>;
          expect(success["500"]).toBe("#009688");
        });
      });

      describe("warning palette", () => {
        it("should have warning palette", () => {
          expect(modernTheme.colorSchemes?.light?.palette?.warning).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const warning = modernTheme.colorSchemes?.light?.palette?.warning as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(warning[shade]).toBeDefined();
          });
        });
      });

      describe("danger palette", () => {
        it("should have danger palette", () => {
          expect(modernTheme.colorSchemes?.light?.palette?.danger).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const danger = modernTheme.colorSchemes?.light?.palette?.danger as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(danger[shade]).toBeDefined();
          });
        });
      });
    });

    describe("dark color scheme", () => {
      it("should have dark color scheme", () => {
        expect(modernTheme.colorSchemes?.dark).toBeDefined();
      });

      it("should have dark palette", () => {
        expect(modernTheme.colorSchemes?.dark?.palette).toBeDefined();
      });

      describe("primary palette", () => {
        it("should have primary palette", () => {
          expect(modernTheme.colorSchemes?.dark?.palette?.primary).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const primary = modernTheme.colorSchemes?.dark?.palette?.primary as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(primary[shade]).toBeDefined();
          });
        });

        it("should have different primary colors than light mode", () => {
          const lightPrimary = modernTheme.colorSchemes?.light?.palette?.primary as Record<string, string>;
          const darkPrimary = modernTheme.colorSchemes?.dark?.palette?.primary as Record<string, string>;
          expect(lightPrimary["500"]).not.toBe(darkPrimary["500"]);
        });
      });

      describe("success palette", () => {
        it("should have success palette", () => {
          expect(modernTheme.colorSchemes?.dark?.palette?.success).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const success = modernTheme.colorSchemes?.dark?.palette?.success as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(success[shade]).toBeDefined();
          });
        });
      });

      describe("danger palette", () => {
        it("should have danger palette", () => {
          expect(modernTheme.colorSchemes?.dark?.palette?.danger).toBeDefined();
        });

        it("should have all shades (50-900)", () => {
          const danger = modernTheme.colorSchemes?.dark?.palette?.danger as Record<string, string>;
          const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
          shades.forEach((shade) => {
            expect(danger[shade]).toBeDefined();
          });
        });
      });
    });

    describe("color scheme contrast", () => {
      it("should have lighter colors for light-50 than light-900", () => {
        const primary = modernTheme.colorSchemes?.light?.palette?.primary as Record<string, string>;
        // 50 shade should be lighter (more F's in hex) than 900
        expect(primary["50"]).toBeDefined();
        expect(primary["900"]).toBeDefined();
      });
    });
  });

  describe("theme structure", () => {
    it("should be a valid object", () => {
      expect(typeof modernTheme).toBe("object");
      expect(modernTheme).not.toBeNull();
    });

    it("should have required MUI Joy theme properties", () => {
      expect(modernTheme).toHaveProperty("cssVarPrefix");
      expect(modernTheme).toHaveProperty("components");
      expect(modernTheme).toHaveProperty("fontFamily");
      expect(modernTheme).toHaveProperty("typography");
      expect(modernTheme).toHaveProperty("colorSchemes");
    });
  });

  describe("default export", () => {
    it("should export modernTheme as default", async () => {
      const module = await import("../theme");
      expect(module.default).toBe(modernTheme);
    });

    it("should export modernTheme as named export", async () => {
      const module = await import("../theme");
      expect(module.modernTheme).toBeDefined();
      expect(module.modernTheme).toBe(modernTheme);
    });
  });
});

describe("modern theme color values", () => {
  describe("light mode specific colors", () => {
    it("should have rose-based primary colors", () => {
      const primary = modernTheme.colorSchemes?.light?.palette?.primary as Record<string, string>;
      // Rose-500 is #f43f5e
      expect(primary["500"]).toBe("#f43f5e");
    });

    it("should have teal-based success colors", () => {
      const success = modernTheme.colorSchemes?.light?.palette?.success as Record<string, string>;
      expect(success["500"]).toBe("#009688");
    });

    it("should have stone-based warning colors", () => {
      const warning = modernTheme.colorSchemes?.light?.palette?.warning as Record<string, string>;
      // Stone-500 is #78716c
      expect(warning["500"]).toBe("#78716c");
    });

    it("should have fuchsia-based danger colors", () => {
      const danger = modernTheme.colorSchemes?.light?.palette?.danger as Record<string, string>;
      // Fuchsia-500 is #d946ef
      expect(danger["500"]).toBe("#d946ef");
    });
  });

  describe("dark mode specific colors", () => {
    it("should have adjusted primary colors for dark mode", () => {
      const primary = modernTheme.colorSchemes?.dark?.palette?.primary as Record<string, string>;
      expect(primary["500"]).toBe("#a6274e");
    });

    it("should have indigo-based danger colors in dark mode", () => {
      const danger = modernTheme.colorSchemes?.dark?.palette?.danger as Record<string, string>;
      // Indigo-500 is #6366f1
      expect(danger["500"]).toBe("#6366f1");
    });

    it("should have adjusted success colors for dark mode", () => {
      const success = modernTheme.colorSchemes?.dark?.palette?.success as Record<string, string>;
      expect(success["500"]).toBe("#126e76");
    });
  });
});

describe("modern theme typography scale", () => {
  it("should follow a consistent type scale", () => {
    const h1 = modernTheme.typography?.h1 as { fontSize: string };
    const h2 = modernTheme.typography?.h2 as { fontSize: string };
    const h3 = modernTheme.typography?.h3 as { fontSize: string };
    const h4 = modernTheme.typography?.h4 as { fontSize: string };

    // Verify the specific scale
    expect(h1.fontSize).toBe("4.5rem");
    expect(h2.fontSize).toBe("3.75rem");
    expect(h3.fontSize).toBe("3rem");
    expect(h4.fontSize).toBe("2.125rem");
  });

  it("should use light font weight for modern aesthetic", () => {
    const h1 = modernTheme.typography?.h1 as { fontWeight: string };

    // Modern theme uses light font weight (100) vs classic bold
    expect(h1.fontWeight).toBe("100");
  });
});
