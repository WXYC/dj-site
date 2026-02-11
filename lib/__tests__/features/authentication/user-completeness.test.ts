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
  it("should return false for complete user", () => {
    const session = createTestBetterAuthSession();

    expect(isUserIncomplete(session)).toBe(false);
  });

  it("should return true when realName is missing", () => {
    const session = createTestIncompleteSession(["realName"]);

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return true when djName is missing", () => {
    const session = createTestIncompleteSession(["djName"]);

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return true when realName is empty string", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "",
        djName: "DJ Test",
      },
    });

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return true when realName is whitespace only", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "   ",
        djName: "DJ Test",
      },
    });

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return true when djName is whitespace only", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "Valid Name",
        djName: "   ",
      },
    });

    expect(isUserIncomplete(session)).toBe(true);
  });

  it("should return false when both names have valid values", () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "test",
        emailVerified: true,
        realName: "Valid Real Name",
        djName: "Valid DJ Name",
      },
    });

    expect(isUserIncomplete(session)).toBe(false);
  });

  it("should return true when both names are missing", () => {
    const session = createTestIncompleteSession(["realName", "djName"]);

    expect(isUserIncomplete(session)).toBe(true);
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

  it("should return djName when missing", () => {
    const session = createTestIncompleteSession(["djName"]);

    const result = getIncompleteUserAttributes(session);

    expect(result).toContain("djName");
    expect(result).not.toContain("realName");
  });

  it("should return both when both are missing", () => {
    const session = createTestIncompleteSession(["realName", "djName"]);

    const result = getIncompleteUserAttributes(session);

    expect(result).toContain("realName");
    expect(result).toContain("djName");
  });

  it("should detect empty string as missing", () => {
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
    expect(result).toContain("djName");
  });

  it("should detect whitespace-only strings as missing", () => {
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
    expect(result).toContain("djName");
  });
});
