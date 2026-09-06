import { describe, it, expect } from "vitest";
import {
  convertBetterAuthToAccountResult,
  BetterAuthUser,
} from "@/lib/features/admin/conversions-better-auth";
import { AdminAuthenticationStatus, Authorization } from "@/lib/features/admin/types";

function createTestBetterAuthUser(
  overrides: Partial<BetterAuthUser> = {}
): BetterAuthUser {
  return {
    id: "user-1",
    email: "test@wxyc.org",
    name: "Test User",
    username: "testuser",
    emailVerified: true,
    role: "dj",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("convertBetterAuthToAccountResult", () => {
  it("should map hasCompletedOnboarding: true", () => {
    const user = createTestBetterAuthUser({ hasCompletedOnboarding: true });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.hasCompletedOnboarding).toBe(true);
  });

  it("should map hasCompletedOnboarding: false", () => {
    const user = createTestBetterAuthUser({ hasCompletedOnboarding: false });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.hasCompletedOnboarding).toBe(false);
  });

  it("should default hasCompletedOnboarding to false when undefined", () => {
    const user = createTestBetterAuthUser({ hasCompletedOnboarding: undefined });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.hasCompletedOnboarding).toBe(false);
  });

  it("should map basic user fields", () => {
    const user = createTestBetterAuthUser({
      username: "djcat",
      realName: "Cat Power",
      djName: "DJ Cat",
      email: "cat@wxyc.org",
    });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.userName).toBe("djcat");
    expect(account.realName).toBe("Cat Power");
    expect(account.djName).toBe("DJ Cat");
    expect(account.email).toBe("cat@wxyc.org");
  });

  // better-auth's `name` column has been silently duplicating DJs' legal
  // names; it must never surface through userName or realName, which
  // display data an admin reads as the handle and the legal name
  // respectively.
  it("should not fall back to name for userName when username is absent", () => {
    const user = createTestBetterAuthUser({
      username: undefined,
      name: "Legal Name Should Not Leak",
    });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.userName).toBe("");
  });

  it("should not fall back to name for realName when realName is absent", () => {
    const user = createTestBetterAuthUser({
      realName: undefined,
      name: "Legal Name Should Not Leak",
    });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.realName).toBe("No Real Name");
  });

  it("should map role to authorization", () => {
    const user = createTestBetterAuthUser({ role: "stationManager" });
    const account = convertBetterAuthToAccountResult(user);
    expect(account.authorization).toBe(Authorization.SM);
  });

  it("should map emailVerified to authType", () => {
    const unverified = createTestBetterAuthUser({ emailVerified: false });
    expect(convertBetterAuthToAccountResult(unverified).authType).toBe(
      AdminAuthenticationStatus.New
    );

    const verified = createTestBetterAuthUser({ emailVerified: true });
    expect(convertBetterAuthToAccountResult(verified).authType).toBe(
      AdminAuthenticationStatus.Confirmed
    );
  });

  // Mirrors the hasCompletedOnboarding coverage above: this is the one place
  // the self-signup review queue can silently become a no-op, since every
  // other test builds `Account` directly and bypasses this conversion.
  describe("selfSignupAt / selfSignupReviewedAt", () => {
    it("should map selfSignupAt to an ISO string when present", () => {
      const user = createTestBetterAuthUser({
        selfSignupAt: new Date("2026-08-01T00:00:00Z"),
      });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupAt).toBe("2026-08-01T00:00:00.000Z");
    });

    it("should map selfSignupAt to null when absent", () => {
      const user = createTestBetterAuthUser({ selfSignupAt: undefined });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupAt).toBeNull();
    });

    it("should map selfSignupAt to null when explicitly null", () => {
      const user = createTestBetterAuthUser({ selfSignupAt: null });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupAt).toBeNull();
    });

    it("should map selfSignupReviewedAt to an ISO string when present", () => {
      const user = createTestBetterAuthUser({
        selfSignupReviewedAt: new Date("2026-08-02T00:00:00Z"),
      });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupReviewedAt).toBe("2026-08-02T00:00:00.000Z");
    });

    it("should map selfSignupReviewedAt to null when absent", () => {
      const user = createTestBetterAuthUser({ selfSignupReviewedAt: undefined });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupReviewedAt).toBeNull();
    });

    it("should map selfSignupReviewedAt to null when explicitly null", () => {
      const user = createTestBetterAuthUser({ selfSignupReviewedAt: null });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupReviewedAt).toBeNull();
    });

    // Never Date instances: a Date surviving this boundary reaches the RTK
    // Query roster cache and the rightbar panel's Redux payload, tripping
    // `serializableCheck` outside production.
    it("should never return a Date instance for either field", () => {
      const user = createTestBetterAuthUser({
        selfSignupAt: new Date("2026-08-01T00:00:00Z"),
        selfSignupReviewedAt: new Date("2026-08-02T00:00:00Z"),
      });
      const account = convertBetterAuthToAccountResult(user);
      expect(account.selfSignupAt).not.toBeInstanceOf(Date);
      expect(account.selfSignupReviewedAt).not.toBeInstanceOf(Date);
    });
  });
});
