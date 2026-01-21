import { describe, it, expect } from "vitest";
import {
  applicationSlice,
  defaultApplicationFrontendState,
} from "@/lib/features/application/frontend";
import { RightbarMenu } from "@/lib/features/application/types";
import { describeSlice } from "@/lib/test-utils";

describeSlice(applicationSlice, defaultApplicationFrontendState, ({ harness, actions }) => {
  describe("setRightbarMini action", () => {
    it.each([true, false])("should set mini to %s", (value) => {
      const result = harness().reduce(actions.setRightbarMini(value));
      expect(result.rightbar.mini).toBe(value);
    });
  });

  describe("setRightbarMenu action", () => {
    it.each([
      [RightbarMenu.BIN, false],
      [RightbarMenu.CATALOG_EDITOR, true],
    ] as const)("should set menu to %s and mini to %s", (menu, expectedMini) => {
      const result = harness().reduce(actions.setRightbarMenu(menu));
      expect(result.rightbar.menu).toBe(menu);
      expect(result.rightbar.mini).toBe(expectedMini);
    });
  });

  describe("closeSidebar action", () => {
    it("should set sidebarOpen to false", () => {
      const withSidebarOpen = {
        ...harness().initialState,
        rightbar: {
          ...harness().initialState.rightbar,
          sidebarOpen: true,
        },
      };
      const result = harness().reduce(actions.closeSidebar(), withSidebarOpen);
      expect(result.rightbar.sidebarOpen).toBe(false);
    });
  });

  describe("toggleSidebar action", () => {
    it("should toggle sidebarOpen from false to true", () => {
      const result = harness().reduce(actions.toggleSidebar());
      expect(result.rightbar.sidebarOpen).toBe(true);
    });

    it("should toggle sidebarOpen from true to false", () => {
      const result = harness().chain(
        actions.toggleSidebar(),
        actions.toggleSidebar()
      );
      expect(result.rightbar.sidebarOpen).toBe(false);
    });
  });

  describe("reset action", () => {
    it("should reset state to default", () => {
      const result = harness().chain(
        actions.setRightbarMini(true),
        actions.toggleSidebar(),
        actions.setRightbarMenu(RightbarMenu.CATALOG_EDITOR),
        actions.reset()
      );
      expect(result).toEqual(defaultApplicationFrontendState);
    });
  });
});
