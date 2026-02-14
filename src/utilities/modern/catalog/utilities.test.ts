import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openSidebarCSS, closeSidebarCSS, toggleSidebarCSS } from "./utilities";

describe("catalog utilities", () => {
  beforeEach(() => {
    // Reset document state
    document.body.style.overflow = "";
    document.documentElement.style.removeProperty("--SideNavigation-slideIn");
  });

  afterEach(() => {
    // Clean up
    document.body.style.overflow = "";
    document.documentElement.style.removeProperty("--SideNavigation-slideIn");
  });

  describe("openSidebarCSS", () => {
    it("should set overflow to hidden on body", () => {
      openSidebarCSS();
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("should set --SideNavigation-slideIn CSS variable to 1", () => {
      openSidebarCSS();
      const value = document.documentElement.style.getPropertyValue("--SideNavigation-slideIn");
      expect(value).toBe("1");
    });
  });

  describe("closeSidebarCSS", () => {
    it("should remove overflow from body", () => {
      document.body.style.overflow = "hidden";
      closeSidebarCSS();
      expect(document.body.style.overflow).toBe("");
    });

    it("should remove --SideNavigation-slideIn CSS variable", () => {
      document.documentElement.style.setProperty("--SideNavigation-slideIn", "1");
      closeSidebarCSS();
      const value = document.documentElement.style.getPropertyValue("--SideNavigation-slideIn");
      expect(value).toBe("");
    });
  });

  describe("toggleSidebarCSS", () => {
    it("should open sidebar when it is closed", () => {
      toggleSidebarCSS();
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.getPropertyValue("--SideNavigation-slideIn")).toBe("1");
    });

    it("should close sidebar when it is open", () => {
      // First open the sidebar
      openSidebarCSS();

      // Then toggle should close it
      toggleSidebarCSS();
      expect(document.body.style.overflow).toBe("");
      expect(document.documentElement.style.getPropertyValue("--SideNavigation-slideIn")).toBe("");
    });
  });
});
