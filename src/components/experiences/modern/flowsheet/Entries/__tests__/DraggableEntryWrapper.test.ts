import { describe, it, expect } from "vitest";

/**
 * Bug 1: Operator precedence in DraggableEntryWrapper background color.
 *
 * The expression `variant ?? "plain" == "plain"` evaluates as
 * `variant ?? ("plain" == "plain")` = `variant ?? true`, which is
 * always truthy. The backdrop branch is dead code.
 *
 * The correct expression is `(variant ?? "plain") == "plain"`.
 */

function resolveBackground(variant: string | undefined): "palette" | "backdrop" {
  // Current (buggy) logic, extracted from DraggableEntryWrapper.tsx L39
  const usePalette = variant ?? "plain" == "plain";
  return usePalette ? "palette" : "backdrop";
}

function resolveBackgroundFixed(variant: string | undefined): "palette" | "backdrop" {
  const usePalette = (variant ?? "plain") == "plain";
  return usePalette ? "palette" : "backdrop";
}

describe("DraggableEntryWrapper background (Bug 1)", () => {
  describe("buggy behavior (without parentheses)", () => {
    it("uses palette for variant=undefined (correct by accident)", () => {
      expect(resolveBackground(undefined)).toBe("palette");
    });

    it("uses palette for variant='plain' (correct by accident)", () => {
      expect(resolveBackground("plain")).toBe("palette");
    });

    it("INCORRECTLY uses palette for variant='solid' (should be backdrop)", () => {
      // This demonstrates the bug: "solid" is truthy, so `"solid" ?? true` = "solid"
      // which is truthy, so palette is always chosen
      expect(resolveBackground("solid")).toBe("palette");
    });
  });

  describe("fixed behavior (with parentheses)", () => {
    it("uses palette for variant=undefined", () => {
      expect(resolveBackgroundFixed(undefined)).toBe("palette");
    });

    it("uses palette for variant='plain'", () => {
      expect(resolveBackgroundFixed("plain")).toBe("palette");
    });

    it("uses backdrop for variant='solid'", () => {
      expect(resolveBackgroundFixed("solid")).toBe("backdrop");
    });

    it("uses backdrop for variant='soft'", () => {
      expect(resolveBackgroundFixed("soft")).toBe("backdrop");
    });

    it("uses backdrop for variant='outlined'", () => {
      expect(resolveBackgroundFixed("outlined")).toBe("backdrop");
    });
  });
});
