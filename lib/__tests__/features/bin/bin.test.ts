import { describe, it, expect } from "vitest";
import { binSlice, defaultBinFrontendState } from "@/lib/features/bin/frontend";
import { describeSlice } from "@/lib/test-utils";

describeSlice(binSlice, defaultBinFrontendState, ({ harness, actions }) => {
  describe("setSearchQuery action", () => {
    it("should set searchQuery", () => {
      const result = harness().reduce(actions.setSearchQuery("test search"));
      expect(result.searchQuery).toBe("test search");
    });

    it("should allow empty searchQuery", () => {
      const result = harness().chain(
        actions.setSearchQuery("test"),
        actions.setSearchQuery("")
      );
      expect(result.searchQuery).toBe("");
    });

    it("should update searchQuery multiple times", () => {
      const result = harness().chain(
        actions.setSearchQuery("first"),
        actions.setSearchQuery("second"),
        actions.setSearchQuery("third")
      );
      expect(result.searchQuery).toBe("third");
    });
  });
});
