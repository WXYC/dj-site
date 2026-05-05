import { describe, it, expect } from "vitest";
import {
  getUsernameError,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
} from "./usernameValidation";

describe("getUsernameError", () => {
  describe("valid usernames", () => {
    it.each([
      ["lowercase", "billb"],
      ["mixed case", "BillB"],
      ["with underscore", "bill_b"],
      ["with dot", "bill.b"],
      ["digits only", "12345"],
      ["minimum length", "a".repeat(MIN_USERNAME_LENGTH)],
      ["maximum length", "a".repeat(MAX_USERNAME_LENGTH)],
    ])('should accept %s ("%s")', (_label, input) => {
      expect(getUsernameError(input)).toBeNull();
    });
  });

  describe("rejected usernames", () => {
    it("should reject internal whitespace", () => {
      expect(getUsernameError("bill b")).toMatch(/no spaces/i);
    });

    it.each([
      ["dash", "bill-b"],
      ["at", "bill@b"],
      ["apostrophe", "bill's"],
      ["unicode", "billé"],
    ])("should reject %s", (_label, input) => {
      expect(getUsernameError(input)).toMatch(/letters/i);
    });

    it("should reject empty string with too-short message", () => {
      expect(getUsernameError("")).toMatch(/at least 3/);
    });

    it("should reject MIN-1 with too-short message", () => {
      expect(getUsernameError("a".repeat(MIN_USERNAME_LENGTH - 1))).toMatch(
        /at least 3/
      );
    });

    it("should reject MAX+1 with too-long message", () => {
      expect(getUsernameError("a".repeat(MAX_USERNAME_LENGTH + 1))).toMatch(
        /at most 30/
      );
    });
  });
});
