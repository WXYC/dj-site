import { describe, it, expect } from "vitest";
import { toTitleCase } from "../stringutilities";

describe("stringutilities", () => {
  describe("toTitleCase", () => {
    it("should capitalize first letter of each word", () => {
      expect(toTitleCase("hello world")).toBe("Hello World");
    });

    it("should handle single word", () => {
      expect(toTitleCase("hello")).toBe("Hello");
    });

    it("should handle already capitalized words", () => {
      expect(toTitleCase("Hello World")).toBe("Hello World");
    });

    it("should handle all uppercase input", () => {
      expect(toTitleCase("HELLO WORLD")).toBe("HELLO WORLD");
    });

    it("should handle empty string", () => {
      expect(toTitleCase("")).toBe("");
    });

    it("should handle string with numbers", () => {
      expect(toTitleCase("hello world 123")).toBe("Hello World 123");
    });

    it("should handle multiple spaces", () => {
      expect(toTitleCase("hello  world")).toBe("Hello  World");
    });

    it("should handle string with special characters", () => {
      expect(toTitleCase("hello-world")).toBe("Hello-World");
    });

    it("should handle string starting with special character", () => {
      expect(toTitleCase("-hello")).toBe("-Hello");
    });

    it("should handle mixed case within words", () => {
      expect(toTitleCase("hElLo WoRlD")).toBe("HElLo WoRlD");
    });
  });
});
