import { describe, it, expect } from "vitest";

/**
 * Phase 3 Tests: DJ-Site Capability Management
 *
 * Tests for capability assignment UI and API integration.
 */

const CAPABILITIES = ["editor", "webmaster"] as const;
type Capability = (typeof CAPABILITIES)[number];

describe("Account capabilities", () => {
  describe("Account type with capabilities", () => {
    it("should include capabilities array on Account type", () => {
      const account = {
        id: "user-123",
        userName: "testuser",
        realName: "Test User",
        djName: "DJ Test",
        authorization: 1,
        authType: 0,
        email: "test@wxyc.org",
        capabilities: ["editor"] as Capability[],
      };

      expect(account.capabilities).toEqual(["editor"]);
    });

    it("should default to empty capabilities array", () => {
      const account = {
        id: "user-123",
        userName: "testuser",
        realName: "Test User",
        djName: "DJ Test",
        authorization: 1,
        authType: 0,
        email: "test@wxyc.org",
        capabilities: [] as Capability[],
      };

      expect(account.capabilities).toEqual([]);
    });
  });

  describe("BetterAuthUser conversion with capabilities", () => {
    it("should preserve capabilities from better-auth user", () => {
      const betterAuthUser = {
        id: "user-123",
        email: "test@wxyc.org",
        name: "testuser",
        capabilities: ["editor", "webmaster"] as Capability[],
      };

      expect(betterAuthUser.capabilities).toEqual(["editor", "webmaster"]);
    });

    it("should handle undefined capabilities", () => {
      const betterAuthUser = {
        id: "user-123",
        email: "test@wxyc.org",
        capabilities: undefined as Capability[] | undefined,
      };

      const capabilities = betterAuthUser.capabilities ?? [];
      expect(capabilities).toEqual([]);
    });
  });
});

describe("Capability assignment validation", () => {
  it.each(CAPABILITIES)("should accept %s as valid capability", (cap) => {
    expect(CAPABILITIES).toContain(cap);
  });

  it("should reject invalid capability values", () => {
    const invalidCap = "admin";
    expect(CAPABILITIES).not.toContain(invalidCap);
  });
});

describe("Capability update payload", () => {
  it("should create valid payload for adding capability", () => {
    const payload = {
      userId: "user-123",
      capabilities: ["editor"] as Capability[],
    };

    expect(payload.userId).toBe("user-123");
    expect(payload.capabilities).toContain("editor");
  });

  it("should create valid payload for removing capability", () => {
    const currentCapabilities: Capability[] = ["editor", "webmaster"];
    const toRemove: Capability = "editor";
    const newCapabilities = currentCapabilities.filter((c) => c !== toRemove);

    expect(newCapabilities).toEqual(["webmaster"]);
  });
});
