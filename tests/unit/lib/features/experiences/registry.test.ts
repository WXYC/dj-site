import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EXPERIENCE_REGISTRY,
  getExperienceConfig,
  getEnabledExperiences,
  isExperienceEnabled,
  getDefaultExperience,
  getAllowedExperiences,
  isExperienceSwitchingAllowed,
} from "@/lib/features/experiences/registry";

describe("registry", () => {
  describe("EXPERIENCE_REGISTRY", () => {
    it("should have classic and modern experiences", () => {
      expect(EXPERIENCE_REGISTRY.classic).toBeDefined();
      expect(EXPERIENCE_REGISTRY.modern).toBeDefined();
    });

    it("should have correct classic experience config", () => {
      const classic = EXPERIENCE_REGISTRY.classic;
      expect(classic.id).toBe("classic");
      expect(classic.name).toBe("Classic");
      expect(classic.enabled).toBe(true);
      expect(classic.cssIdentifier).toBe("classic");
      expect(classic.features.hasRightbar).toBe(false);
      expect(classic.features.hasLeftbar).toBe(false);
      expect(classic.features.hasMobileHeader).toBe(false);
      expect(classic.features.supportsThemeToggle).toBe(false);
    });

    it("should have correct modern experience config", () => {
      const modern = EXPERIENCE_REGISTRY.modern;
      expect(modern.id).toBe("modern");
      expect(modern.name).toBe("Modern");
      expect(modern.enabled).toBe(true);
      expect(modern.cssIdentifier).toBe("modern");
      expect(modern.features.hasRightbar).toBe(true);
      expect(modern.features.hasLeftbar).toBe(true);
      expect(modern.features.hasMobileHeader).toBe(true);
      expect(modern.features.supportsThemeToggle).toBe(true);
    });
  });

  describe("getExperienceConfig", () => {
    it("should return classic config", () => {
      const config = getExperienceConfig("classic");
      expect(config.id).toBe("classic");
      expect(config.name).toBe("Classic");
    });

    it("should return modern config", () => {
      const config = getExperienceConfig("modern");
      expect(config.id).toBe("modern");
      expect(config.name).toBe("Modern");
    });
  });

  describe("getEnabledExperiences", () => {
    it("should return all enabled experiences", () => {
      const experiences = getEnabledExperiences();
      expect(experiences.length).toBeGreaterThan(0);
      expect(experiences.every((exp) => exp.enabled)).toBe(true);
    });

    it("should include both classic and modern when enabled", () => {
      const experiences = getEnabledExperiences();
      const ids = experiences.map((exp) => exp.id);
      expect(ids).toContain("classic");
      expect(ids).toContain("modern");
    });
  });

  describe("isExperienceEnabled", () => {
    it("should return true for classic", () => {
      expect(isExperienceEnabled("classic")).toBe(true);
    });

    it("should return true for modern", () => {
      expect(isExperienceEnabled("modern")).toBe(true);
    });
  });

  describe("getDefaultExperience", () => {
    const originalEnv = process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE;
      } else {
        process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE = originalEnv;
      }
    });

    it("should return modern by default when env is not set", () => {
      delete process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE;
      expect(getDefaultExperience()).toBe("modern");
    });

    it("should return classic when env is set to classic", () => {
      process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE = "classic";
      expect(getDefaultExperience()).toBe("classic");
    });

    it("should return modern when env is set to modern", () => {
      process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE = "modern";
      expect(getDefaultExperience()).toBe("modern");
    });

    it("should return modern for invalid env value", () => {
      process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE = "invalid";
      expect(getDefaultExperience()).toBe("modern");
    });
  });

  describe("getAllowedExperiences", () => {
    const originalEnv = process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES;
      } else {
        process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES = originalEnv;
      }
    });

    it("should return both experiences by default when env is not set", () => {
      delete process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES;
      const allowed = getAllowedExperiences();
      expect(allowed).toContain("classic");
      expect(allowed).toContain("modern");
    });

    it("should parse comma-separated list from env", () => {
      process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES = "modern,classic";
      const allowed = getAllowedExperiences();
      expect(allowed).toContain("modern");
      expect(allowed).toContain("classic");
    });

    it("should filter out invalid experience names", () => {
      process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES = "modern,invalid,classic";
      const allowed = getAllowedExperiences();
      expect(allowed).toContain("modern");
      expect(allowed).toContain("classic");
      expect(allowed).not.toContain("invalid");
    });

    it("should handle single experience", () => {
      process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES = "modern";
      const allowed = getAllowedExperiences();
      expect(allowed).toEqual(["modern"]);
    });

    it("should trim whitespace from entries", () => {
      process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES = " modern , classic ";
      const allowed = getAllowedExperiences();
      expect(allowed).toContain("modern");
      expect(allowed).toContain("classic");
    });
  });

  describe("isExperienceSwitchingAllowed", () => {
    const originalEnv = process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING;
      } else {
        process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING = originalEnv;
      }
    });

    it("should return true by default when env is not set", () => {
      delete process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING;
      expect(isExperienceSwitchingAllowed()).toBe(true);
    });

    it("should return false when env is 'false'", () => {
      process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING = "false";
      expect(isExperienceSwitchingAllowed()).toBe(false);
    });

    it("should return false when env is '0'", () => {
      process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING = "0";
      expect(isExperienceSwitchingAllowed()).toBe(false);
    });

    it("should return true when env is 'true'", () => {
      process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING = "true";
      expect(isExperienceSwitchingAllowed()).toBe(true);
    });

    it("should return true when env is any other value", () => {
      process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING = "yes";
      expect(isExperienceSwitchingAllowed()).toBe(true);
    });
  });
});
