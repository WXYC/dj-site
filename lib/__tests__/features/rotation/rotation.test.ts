import { describe, it, expect } from "vitest";
import {
  rotationSlice,
  defaultRotationFrontendState,
} from "@/lib/features/rotation/frontend";
import { describeSlice } from "@/lib/test-utils";

describeSlice(rotationSlice, defaultRotationFrontendState, ({ harness, actions }) => {
  describe("setOrderBy action", () => {
    it.each(["artist", "title", "album"] as const)("should set orderBy to %s", (value) => {
      const result = harness().reduce(actions.setOrderBy(value));
      expect(result.orderBy).toBe(value);
    });
  });

  describe("setOrderDirection action", () => {
    it.each(["asc", "desc"] as const)("should set orderDirection to %s", (value) => {
      const result = harness().reduce(actions.setOrderDirection(value));
      expect(result.orderDirection).toBe(value);
    });
  });

  describe("selectors", () => {
    it("should select orderBy", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(rotationSlice.selectors.orderBy)).toBe("title");

      dispatch(actions.setOrderBy("artist"));
      expect(select(rotationSlice.selectors.orderBy)).toBe("artist");
    });

    it("should select orderDirection", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(rotationSlice.selectors.orderDirection)).toBe("asc");

      dispatch(actions.setOrderDirection("desc"));
      expect(select(rotationSlice.selectors.orderDirection)).toBe("desc");
    });
  });
});
