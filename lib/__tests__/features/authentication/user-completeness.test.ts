import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

import {
  isUserIncomplete,
  getIncompleteUserAttributes,
} from "@/lib/features/authentication/server-utils";
import {
  createTestBetterAuthSession,
  createTestIncompleteSession,
} from "@/lib/test-utils";

describe("isUserIncomplete", () => {
  it("should return false for complete user with hasCompletedOnboarding true", () => {
    const session = createTestBetterAuthSession();

    expect(isUserIncomplete(session)).toBe(false);
  });

  it("should return true when hasCompletedOnboarding is false", () => {
    const session = createTestIncompleteSession(["realName"]);

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return true when hasCompletedOnboarding is false even if all profile fields are filled", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "Valid Real Name",
        djName: "Valid DJ Name",
        hasCompletedOnboarding: false,
      },
    });

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return false when hasCompletedOnboarding is true even if realName is empty", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "",
        djName: "DJ Test",
        hasCompletedOnboarding: true,
      },
    });

    expect(isUserIncomplete(session)).toBe(false);
  });

  it("should return false when hasCompletedOnboarding is undefined (backward compat)", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "Valid Name",
        djName: "DJ Test",
        hasCompletedOnboarding: undefined,
      },
    });

    expect(isUserIncomplete(session)).toBe(false);
  });
});

describe("getIncompleteUserAttributes", () => {
  it("should return empty array for complete user", () => {
    const session = createTestBetterAuthSession();

    expect(getIncompleteUserAttributes(session)).toEqual([]);
  });

  it("should return realName when missing", () => {
    const session = createTestIncompleteSession(["realName"]);

    const result = getIncompleteUserAttributes(session);

    expect(result).toContain("realName");
    expect(result).not.toContain("djName");
  });

  it("should not return djName when missing (djName is optional)", () => {
    const session = createTestIncompleteSession(["djName"]);

    const result = getIncompleteUserAttributes(session);

    expect(result).not.toContain("djName");
    expect(result).not.toContain("realName");
  });

  it("should return only realName when both are missing (djName is optional)", () => {
    const session = createTestIncompleteSession(["realName", "djName"]);

    const result = getIncompleteUserAttributes(session);

    expect(result).toContain("realName");
    expect(result).not.toContain("djName");
  });

  it("should detect empty string realName as missing but not djName (djName is optional)", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "",
        djName: "",
      },
    });

    const result = getIncompleteUserAttributes(session);

    expect(result).toContain("realName");
    expect(result).not.toContain("djName");
  });

  it("should detect whitespace-only realName as missing but not djName (djName is optional)", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "   ",
        djName: "  \t  ",
      },
    });

    const result = getIncompleteUserAttributes(session);

    expect(result).toContain("realName");
    expect(result).not.toContain("djName");
  });
});
