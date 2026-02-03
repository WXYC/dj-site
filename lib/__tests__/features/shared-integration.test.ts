import { describe, it, expect } from "vitest";

/**
 * Integration tests for @wxyc/shared/auth-client package.
 * These tests verify the package is correctly installed and exports are available.
 */
describe("@wxyc/shared/auth-client integration", () => {
  describe("Authorization", () => {
    it("exports Authorization enum with expected values", async () => {
      const { Authorization } = await import("@wxyc/shared/auth-client");

      expect(Authorization.NO).toBe(0);
      expect(Authorization.DJ).toBe(1);
      expect(Authorization.MD).toBe(2);
      expect(Authorization.SM).toBe(3);
      expect(Authorization.ADMIN).toBe(4);
    });

    it("exports roleToAuthorization function", async () => {
      const { roleToAuthorization, Authorization } = await import("@wxyc/shared/auth-client");

      expect(roleToAuthorization("dj")).toBe(Authorization.DJ);
      expect(roleToAuthorization("musicDirector")).toBe(Authorization.MD);
      expect(roleToAuthorization("stationManager")).toBe(Authorization.SM);
      expect(roleToAuthorization("admin")).toBe(Authorization.ADMIN);
      expect(roleToAuthorization("member")).toBe(Authorization.NO);
    });

    it("exports authorizationToRole function", async () => {
      const { authorizationToRole, Authorization } = await import("@wxyc/shared/auth-client");

      expect(authorizationToRole(Authorization.DJ)).toBe("dj");
      expect(authorizationToRole(Authorization.MD)).toBe("musicDirector");
      expect(authorizationToRole(Authorization.SM)).toBe("stationManager");
      expect(authorizationToRole(Authorization.ADMIN)).toBe("admin");
    });
  });

  describe("Branded types and checks", () => {
    it("exports checkRole function", async () => {
      const { checkRole, Authorization } = await import("@wxyc/shared/auth-client");

      const user = { authority: Authorization.SM, capabilities: [] };
      const result = checkRole(user, Authorization.DJ);

      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.user.authority).toBe(Authorization.SM);
      }
    });

    it("checkRole returns unauthorized for insufficient role", async () => {
      const { checkRole, Authorization } = await import("@wxyc/shared/auth-client");

      const user = { authority: Authorization.DJ, capabilities: [] };
      const result = checkRole(user, Authorization.SM);

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.reason).toBe("insufficient_role");
      }
    });

    it("exports checkCapability function", async () => {
      const { checkCapability } = await import("@wxyc/shared/auth-client");

      const user = { authority: 0, capabilities: ["editor" as const] };
      const result = checkCapability(user, "editor");

      expect(result.authorized).toBe(true);
    });

    it("checkCapability returns unauthorized for missing capability", async () => {
      const { checkCapability } = await import("@wxyc/shared/auth-client");

      const user = { authority: 0, capabilities: [] };
      const result = checkCapability(user, "editor");

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.reason).toBe("missing_capability");
      }
    });
  });

  describe("Roles", () => {
    it("exports ROLES constant", async () => {
      const { ROLES } = await import("@wxyc/shared/auth-client");

      expect(ROLES).toContain("admin");
      expect(ROLES).toContain("stationManager");
      expect(ROLES).toContain("musicDirector");
      expect(ROLES).toContain("dj");
      expect(ROLES).toContain("member");
    });

    it("exports hasPermission function", async () => {
      const { hasPermission } = await import("@wxyc/shared/auth-client");

      expect(hasPermission("dj", "catalog", "read")).toBe(true);
      expect(hasPermission("dj", "catalog", "write")).toBe(false);
      expect(hasPermission("musicDirector", "catalog", "write")).toBe(true);
    });

    it("exports canAssignRoles function", async () => {
      const { canAssignRoles } = await import("@wxyc/shared/auth-client");

      expect(canAssignRoles("admin")).toBe(true);
      expect(canAssignRoles("stationManager")).toBe(true);
      expect(canAssignRoles("musicDirector")).toBe(false);
      expect(canAssignRoles("dj")).toBe(false);
    });

    it("exports getAssignableRoles function", async () => {
      const { getAssignableRoles } = await import("@wxyc/shared/auth-client");

      // Admin can assign any role including admin
      const adminAssignable = getAssignableRoles("admin");
      expect(adminAssignable).toContain("admin");
      expect(adminAssignable).toContain("stationManager");

      // SM can assign roles but not admin
      const smAssignable = getAssignableRoles("stationManager");
      expect(smAssignable).not.toContain("admin");
      expect(smAssignable).toContain("stationManager");
      expect(smAssignable).toContain("dj");
    });
  });

  describe("Capabilities", () => {
    it("exports CAPABILITIES constant", async () => {
      const { CAPABILITIES } = await import("@wxyc/shared/auth-client");

      expect(CAPABILITIES).toContain("editor");
      expect(CAPABILITIES).toContain("webmaster");
    });

    it("exports canAssignCapability function", async () => {
      const { canAssignCapability } = await import("@wxyc/shared/auth-client");

      // Admin can assign editor
      expect(canAssignCapability({ role: "admin", capabilities: [] }, "editor")).toBe(true);

      // SM can assign editor
      expect(canAssignCapability({ role: "stationManager", capabilities: [] }, "editor")).toBe(true);

      // Webmaster can assign editor (delegation)
      expect(canAssignCapability({ role: "dj", capabilities: ["webmaster"] }, "editor")).toBe(true);

      // Regular DJ cannot assign editor
      expect(canAssignCapability({ role: "dj", capabilities: [] }, "editor")).toBe(false);
    });
  });
});
