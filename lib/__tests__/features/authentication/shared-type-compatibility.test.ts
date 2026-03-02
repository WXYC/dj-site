import { describe, it, expect } from "vitest";
import {
  Authorization as SharedAuthorization,
  roleToAuthorization,
  type WXYCRole as SharedWXYCRole,
} from "@wxyc/shared/auth-client/auth";
import { Authorization, AdminProtectedRoutes } from "@/lib/features/admin/types";
import { mapRoleToAuthorization, type WXYCRole } from "@/lib/features/authentication/types";

describe("shared type compatibility", () => {
  describe("Authorization enum", () => {
    it("has identical values for NO, DJ, MD, SM", () => {
      expect(SharedAuthorization.NO).toBe(0);
      expect(SharedAuthorization.DJ).toBe(1);
      expect(SharedAuthorization.MD).toBe(2);
      expect(SharedAuthorization.SM).toBe(3);
    });

    it("re-exported Authorization matches shared Authorization", () => {
      expect(Authorization.NO).toBe(SharedAuthorization.NO);
      expect(Authorization.DJ).toBe(SharedAuthorization.DJ);
      expect(Authorization.MD).toBe(SharedAuthorization.MD);
      expect(Authorization.SM).toBe(SharedAuthorization.SM);
    });
  });

  describe("mapRoleToAuthorization aliases roleToAuthorization", () => {
    it("maps standard WXYC roles identically", () => {
      const standardRoles: Array<SharedWXYCRole> = [
        "member",
        "dj",
        "musicDirector",
        "stationManager",
      ];

      for (const role of standardRoles) {
        expect(mapRoleToAuthorization(role)).toBe(roleToAuthorization(role));
      }
    });

    it("maps edge-case inputs identically", () => {
      const edgeCases = [
        "user",
        "station_manager",
        "music_director",
        undefined,
      ] as const;

      for (const input of edgeCases) {
        expect(mapRoleToAuthorization(input)).toBe(roleToAuthorization(input));
      }
    });

    it("maps null to NO authorization", () => {
      expect(roleToAuthorization(null)).toBe(SharedAuthorization.NO);
    });
  });

  describe("AdminProtectedRoutes compatibility", () => {
    it("Authorization.SM resolves to correct routes", () => {
      expect(AdminProtectedRoutes[Authorization.SM]).toEqual([
        "roster",
        "catalog",
      ]);
      expect(AdminProtectedRoutes[Authorization.MD]).toEqual(["catalog"]);
      expect(AdminProtectedRoutes[Authorization.NO]).toEqual([]);
    });
  });

  describe("type compatibility", () => {
    it("WXYCRole from shared is assignable to local usage", () => {
      const sharedRole: SharedWXYCRole = "dj";
      const localRole: WXYCRole = sharedRole;
      expect(localRole).toBe("dj");
    });
  });
});
