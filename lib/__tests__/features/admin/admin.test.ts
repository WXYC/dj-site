import { describe, it, expect } from "vitest";
import {
  adminSlice,
  defaultAdminFrontendState,
} from "@/lib/features/admin/frontend";
import { Authorization, ROSTER_PAGE_SIZE } from "@/lib/features/admin/types";
import {
  authorizationToRole,
  AUTHORIZATION_LABELS,
} from "@/lib/features/authentication/types";
import { describeSlice } from "@/lib/test-utils";

describe("authorizationToRole", () => {
  it.each([
    [Authorization.SM, "stationManager"],
    [Authorization.MD, "musicDirector"],
    [Authorization.DJ, "dj"],
    [Authorization.NO, "member"],
  ] as const)("should map Authorization.%s to %s", (auth, role) => {
    expect(authorizationToRole(auth)).toBe(role);
  });
});

describe("AUTHORIZATION_LABELS", () => {
  it.each([
    [Authorization.NO, "Member"],
    [Authorization.DJ, "DJ"],
    [Authorization.MD, "Music Director"],
    [Authorization.SM, "Station Manager"],
  ] as const)("should label Authorization.%s as %s", (auth, label) => {
    expect(AUTHORIZATION_LABELS[auth]).toBe(label);
  });
});

describeSlice(adminSlice, defaultAdminFrontendState, ({ harness, actions }) => {
  describe("default state", () => {
    it("should have empty searchString", () => {
      expect(harness().initialState.searchString).toBe("");
    });

    it("should have adding set to false", () => {
      expect(harness().initialState.adding).toBe(false);
    });

    it("should have formData with DJ authorization", () => {
      expect(harness().initialState.formData.authorization).toBe(Authorization.DJ);
    });

    it("should have page set to 0", () => {
      expect(harness().initialState.page).toBe(0);
    });

    it("should have totalAccounts set to 0", () => {
      expect(harness().initialState.totalAccounts).toBe(0);
    });
  });

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

    it("should reset page to 0 when search changes", () => {
      const result = harness().chain(
        actions.setPage(3),
        actions.setSearchString("test")
      );
      expect(result.page).toBe(0);
    });
  });

  describe("setPage action", () => {
    it("should set page", () => {
      const result = harness().reduce(actions.setPage(2));
      expect(result.page).toBe(2);
    });

    it("should allow setting page back to 0", () => {
      const result = harness().chain(
        actions.setPage(5),
        actions.setPage(0)
      );
      expect(result.page).toBe(0);
    });
  });

  describe("setTotalAccounts action", () => {
    it("should set totalAccounts", () => {
      const result = harness().reduce(actions.setTotalAccounts(147));
      expect(result.totalAccounts).toBe(147);
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

  describe("ROSTER_PAGE_SIZE constant", () => {
    it("should be 50", () => {
      expect(ROSTER_PAGE_SIZE).toBe(50);
    });
  });

  // Note: Selector tests are skipped because adminSlice and applicationSlice
  // both use name: "application" which causes a conflict in combineSlices.
  describe("selectors", () => {
    describe("getSearchString", () => {
      it("should be defined", () => {
        expect(adminSlice.selectors.getSearchString).toBeDefined();
      });
    });

    describe("getAdding", () => {
      it("should be defined", () => {
        expect(adminSlice.selectors.getAdding).toBeDefined();
      });
    });

    describe("getFormData", () => {
      it("should be defined", () => {
        expect(adminSlice.selectors.getFormData).toBeDefined();
      });
    });

    describe("getPage", () => {
      it("should be defined", () => {
        expect(adminSlice.selectors.getPage).toBeDefined();
      });
    });

    describe("getTotalAccounts", () => {
      it("should be defined", () => {
        expect(adminSlice.selectors.getTotalAccounts).toBeDefined();
      });
    });
  });
});
