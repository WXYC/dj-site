import { describe, it, expect } from "vitest";
import {
  adminSlice,
  defaultAdminFrontendState,
} from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";
import { describeSlice } from "@/lib/test-utils";

describeSlice(adminSlice, defaultAdminFrontendState, ({ harness, actions }) => {
  describe("setSearchString action", () => {
    it("should set searchString", () => {
      const result = harness().reduce(actions.setSearchString("test search"));
      expect(result.searchString).toBe("test search");
    });

    it("should allow empty searchString", () => {
      const result = harness().chain(
        actions.setSearchString("test"),
        actions.setSearchString("")
      );
      expect(result.searchString).toBe("");
    });
  });

  describe("setAdding action", () => {
    it("should set adding to true", () => {
      const result = harness().reduce(actions.setAdding(true));
      expect(result.adding).toBe(true);
    });

    it("should set adding to false", () => {
      const result = harness().chain(
        actions.setAdding(true),
        actions.setAdding(false)
      );
      expect(result.adding).toBe(false);
    });

    it("should reset formData when setting adding to false", () => {
      const result = harness().chain(
        actions.setFormData({ authorization: Authorization.SM }),
        actions.setAdding(true),
        actions.setAdding(false)
      );
      expect(result.formData).toEqual(defaultAdminFrontendState.formData);
    });

    it("should not reset formData when setting adding to true", () => {
      const result = harness().chain(
        actions.setFormData({ authorization: Authorization.SM }),
        actions.setAdding(true)
      );
      expect(result.formData.authorization).toBe(Authorization.SM);
    });
  });

  describe("setFormData action", () => {
    it.each([
      ["SM", Authorization.SM],
      ["MD", Authorization.MD],
      ["DJ", Authorization.DJ],
    ] as const)("should set authorization to %s", (_, auth) => {
      const result = harness().reduce(actions.setFormData({ authorization: auth }));
      expect(result.formData.authorization).toBe(auth);
    });

    it("should merge with existing formData", () => {
      const result = harness().chain(
        actions.setFormData({ authorization: Authorization.SM }),
        actions.setFormData({ authorization: Authorization.MD })
      );
      expect(result.formData.authorization).toBe(Authorization.MD);
    });
  });

  describe("reset action", () => {
    it("should reset state to default", () => {
      const result = harness().chain(
        actions.setSearchString("test search"),
        actions.setAdding(true),
        actions.setFormData({ authorization: Authorization.SM }),
        actions.reset()
      );
      expect(result).toEqual(defaultAdminFrontendState);
    });
  });
});
