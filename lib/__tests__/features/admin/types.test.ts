import { describe, it, expect } from "vitest";
import {
  Authorization,
  AdminAuthenticationStatus,
  AdminProtectedRoutes,
} from "@/lib/features/admin/types";

describe("admin types", () => {
  describe("Authorization enum", () => {
    it("should have NO as value 0", () => {
      expect(Authorization.NO).toBe(0);
    });

    it("should have DJ as value 1", () => {
      expect(Authorization.DJ).toBe(1);
    });

    it("should have MD as value 2", () => {
      expect(Authorization.MD).toBe(2);
    });

    it("should have SM as value 3", () => {
      expect(Authorization.SM).toBe(3);
    });

    it("should have correct hierarchy (NO < DJ < MD < SM)", () => {
      expect(Authorization.NO).toBeLessThan(Authorization.DJ);
      expect(Authorization.DJ).toBeLessThan(Authorization.MD);
      expect(Authorization.MD).toBeLessThan(Authorization.SM);
    });
  });

  describe("AdminAuthenticationStatus enum", () => {
    it("should have Confirmed as value 0", () => {
      expect(AdminAuthenticationStatus.Confirmed).toBe(0);
    });

    it("should have New as value 1", () => {
      expect(AdminAuthenticationStatus.New).toBe(1);
    });

    it("should have Reset as value 2", () => {
      expect(AdminAuthenticationStatus.Reset).toBe(2);
    });
  });

  describe("AdminProtectedRoutes", () => {
    it("should allow SM access to roster and catalog", () => {
      expect(AdminProtectedRoutes[Authorization.SM]).toContain("roster");
      expect(AdminProtectedRoutes[Authorization.SM]).toContain("catalog");
    });

    it("should allow MD access to catalog only", () => {
      expect(AdminProtectedRoutes[Authorization.MD]).toContain("catalog");
      expect(AdminProtectedRoutes[Authorization.MD]).not.toContain("roster");
    });

    it("should not allow NO access to any routes", () => {
      expect(AdminProtectedRoutes[Authorization.NO]).toEqual([]);
    });

    it("should have SM access to more routes than MD", () => {
      const smRoutes = AdminProtectedRoutes[Authorization.SM];
      const mdRoutes = AdminProtectedRoutes[Authorization.MD];
      expect(smRoutes.length).toBeGreaterThan(mdRoutes.length);
    });
  });
});
