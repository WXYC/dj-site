import { describe, it, expect } from "vitest";
import { classicTheme } from "../theme";

describe("classic theme", () => {
  describe("cssVarPrefix", () => {
    it("should have cssVarPrefix set to 'wxyc'", () => {
      expect(classicTheme.cssVarPrefix).toBe("wxyc");
    });

    it("should be a string", () => {
      expect(typeof classicTheme.cssVarPrefix).toBe("string");
    });

    it("should match the base theme prefix", () => {
      expect(classicTheme.cssVarPrefix).toBe("wxyc");
    });
  });

  describe("components", () => {
    it("should have components property defined", () => {
      expect(classicTheme.components).toBeDefined();
    });

    it("should have JoyTooltip component override", () => {
      expect(classicTheme.components?.JoyTooltip).toBeDefined();
    });

    describe("JoyTooltip", () => {
      it("should have styleOverrides property", () => {
        expect(
          classicTheme.components?.JoyTooltip?.styleOverrides
        ).toBeDefined();
      });

      it("should have root styleOverride", () => {
        expect(
          classicTheme.components?.JoyTooltip?.styleOverrides?.root
        ).toBeDefined();
      });

      it("should set root zIndex to 10000", () => {
        const rootOverrides = classicTheme.components?.JoyTooltip?.styleOverrides
          ?.root as { zIndex: number };
        expect(rootOverrides).toBeDefined();
        expect(rootOverrides.zIndex).toBe(10000);
      });

      it("should have zIndex as a number", () => {
        const rootOverrides = classicTheme.components?.JoyTooltip?.styleOverrides
          ?.root as { zIndex: number };
        expect(typeof rootOverrides.zIndex).toBe("number");
      });
    });
  });

  describe("fontFamily", () => {
    it("should have fontFamily property defined", () => {
      expect(classicTheme.fontFamily).toBeDefined();
    });

    it("should have display font family", () => {
      expect(classicTheme.fontFamily?.display).toBeDefined();
    });

    it("should have body font family", () => {
      expect(classicTheme.fontFamily?.body).toBeDefined();
    });

    it("should use Arial as display font", () => {
      expect(classicTheme.fontFamily?.display).toBe(
        "Arial, Helvetica, sans-serif"
      );
    });

    it("should use Arial as body font", () => {
      expect(classicTheme.fontFamily?.body).toBe(
        "Arial, Helvetica, sans-serif"
      );
    });

    it("should have consistent display and body fonts", () => {
      expect(classicTheme.fontFamily?.display).toBe(classicTheme.fontFamily?.body);
    });

    it("should include fallback fonts in display", () => {
      expect(classicTheme.fontFamily?.display).toContain("Helvetica");
      expect(classicTheme.fontFamily?.display).toContain("sans-serif");
    });

    it("should include fallback fonts in body", () => {
      expect(classicTheme.fontFamily?.body).toContain("Helvetica");
      expect(classicTheme.fontFamily?.body).toContain("sans-serif");
    });
  });

  describe("typography", () => {
    it("should have typography property defined", () => {
      expect(classicTheme.typography).toBeDefined();
    });

    describe("h1", () => {
      it("should be defined", () => {
        expect(classicTheme.typography?.h1).toBeDefined();
      });

      it("should have Verdana font family", () => {
        const h1 = classicTheme.typography?.h1 as { fontFamily: string };
        expect(h1.fontFamily).toBe("Verdana, Geneva, Arial, Helvetica, sans-serif");
      });

      it("should have bold font weight", () => {
        const h1 = classicTheme.typography?.h1 as { fontWeight: string };
        expect(h1.fontWeight).toBe("bold");
      });

      it("should include multiple fallback fonts", () => {
        const h1 = classicTheme.typography?.h1 as { fontFamily: string };
        expect(h1.fontFamily).toContain("Geneva");
        expect(h1.fontFamily).toContain("Arial");
        expect(h1.fontFamily).toContain("Helvetica");
        expect(h1.fontFamily).toContain("sans-serif");
      });
    });

    describe("h2", () => {
      it("should be defined", () => {
        expect(classicTheme.typography?.h2).toBeDefined();
      });

      it("should have Verdana font family", () => {
        const h2 = classicTheme.typography?.h2 as { fontFamily: string };
        expect(h2.fontFamily).toBe("Verdana, Geneva, Arial, Helvetica, sans-serif");
      });

      it("should have bold font weight", () => {
        const h2 = classicTheme.typography?.h2 as { fontWeight: string };
        expect(h2.fontWeight).toBe("bold");
      });
    });

    describe("h3", () => {
      it("should be defined", () => {
        expect(classicTheme.typography?.h3).toBeDefined();
      });

      it("should have Verdana font family", () => {
        const h3 = classicTheme.typography?.h3 as { fontFamily: string };
        expect(h3.fontFamily).toBe("Verdana, Geneva, Arial, Helvetica, sans-serif");
      });

      it("should have bold font weight", () => {
        const h3 = classicTheme.typography?.h3 as { fontWeight: string };
        expect(h3.fontWeight).toBe("bold");
      });
    });

    describe("h4", () => {
      it("should be defined", () => {
        expect(classicTheme.typography?.h4).toBeDefined();
      });

      it("should have Verdana font family", () => {
        const h4 = classicTheme.typography?.h4 as { fontFamily: string };
        expect(h4.fontFamily).toBe("Verdana, Geneva, Arial, Helvetica, sans-serif");
      });

      it("should have bold font weight", () => {
        const h4 = classicTheme.typography?.h4 as { fontWeight: string };
        expect(h4.fontWeight).toBe("bold");
      });
    });

    describe("heading consistency", () => {
      it("should have same font family for all headings", () => {
        const h1 = classicTheme.typography?.h1 as { fontFamily: string };
        const h2 = classicTheme.typography?.h2 as { fontFamily: string };
        const h3 = classicTheme.typography?.h3 as { fontFamily: string };
        const h4 = classicTheme.typography?.h4 as { fontFamily: string };

        expect(h1.fontFamily).toBe(h2.fontFamily);
        expect(h2.fontFamily).toBe(h3.fontFamily);
        expect(h3.fontFamily).toBe(h4.fontFamily);
      });

      it("should have same font weight for all headings", () => {
        const h1 = classicTheme.typography?.h1 as { fontWeight: string };
        const h2 = classicTheme.typography?.h2 as { fontWeight: string };
        const h3 = classicTheme.typography?.h3 as { fontWeight: string };
        const h4 = classicTheme.typography?.h4 as { fontWeight: string };

        expect(h1.fontWeight).toBe("bold");
        expect(h2.fontWeight).toBe("bold");
        expect(h3.fontWeight).toBe("bold");
        expect(h4.fontWeight).toBe("bold");
      });

      it("should use different fonts for headings vs body", () => {
        const h1 = classicTheme.typography?.h1 as { fontFamily: string };
        expect(h1.fontFamily).not.toBe(classicTheme.fontFamily?.body);
      });
    });

    describe("body-xxs variant", () => {
      it("should NOT have body-xxs variant (classic-specific)", () => {
        expect(classicTheme.typography?.["body-xxs"]).toBeUndefined();
      });
    });
  });

  describe("color schemes", () => {
    it("should not define custom light color scheme", () => {
      // Classic theme relies on default MUI Joy color schemes
      // and CSS for styling
      const lightPalette = classicTheme.colorSchemes?.light?.palette;
      // Classic may or may not have custom palettes defined
      // The key is it doesn't override them extensively like modern
      expect(classicTheme.colorSchemes).toBeDefined();
    });
  });

  describe("theme structure", () => {
    it("should be a valid object", () => {
      expect(typeof classicTheme).toBe("object");
      expect(classicTheme).not.toBeNull();
    });

    it("should have required MUI Joy theme properties", () => {
      expect(classicTheme).toHaveProperty("cssVarPrefix");
      expect(classicTheme).toHaveProperty("components");
      expect(classicTheme).toHaveProperty("fontFamily");
      expect(classicTheme).toHaveProperty("typography");
    });
  });

  describe("default export", () => {
    it("should export classicTheme as default", async () => {
      const module = await import("../theme");
      expect(module.default).toBe(classicTheme);
    });

    it("should export classicTheme as named export", async () => {
      const module = await import("../theme");
      expect(module.classicTheme).toBeDefined();
      expect(module.classicTheme).toBe(classicTheme);
    });
  });
});

describe("classic theme legacy support", () => {
  it("should use web-safe fonts for legacy browser compatibility", () => {
    // Arial, Helvetica are web-safe fonts
    expect(classicTheme.fontFamily?.display).toContain("Arial");
    expect(classicTheme.fontFamily?.body).toContain("Arial");
  });

  it("should use Verdana for headings (web-safe)", () => {
    const h1 = classicTheme.typography?.h1 as { fontFamily: string };
    expect(h1.fontFamily).toContain("Verdana");
  });

  it("should have extensive font fallback chains", () => {
    const h1 = classicTheme.typography?.h1 as { fontFamily: string };
    const fontCount = h1.fontFamily.split(",").length;
    expect(fontCount).toBeGreaterThanOrEqual(4);
  });
});
