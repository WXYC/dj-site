import { describe, it, expect } from "vitest";
import { toTitleCase } from "./stringutilities";

describe("toTitleCase", () => {
  it("should capitalize first letter of each word", () => {
    expect(toTitleCase("hello world")).toBe("Hello World");
  });

  it("should handle single word", () => {
    expect(toTitleCase("hello")).toBe("Hello");
  });

  it("should handle empty string", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("should handle already capitalized text", () => {
    expect(toTitleCase("Hello World")).toBe("Hello World");
  });

  it("should handle all uppercase", () => {
    expect(toTitleCase("HELLO WORLD")).toBe("HELLO WORLD");
  });

  it("should handle mixed case", () => {
    expect(toTitleCase("hELLO wORLD")).toBe("HELLO WORLD");
  });

  it("should handle multiple spaces", () => {
    expect(toTitleCase("hello  world")).toBe("Hello  World");
  });

  it("should handle special characters", () => {
    expect(toTitleCase("hello-world")).toBe("Hello-World");
  });

  it("should handle numbers", () => {
    expect(toTitleCase("hello 123 world")).toBe("Hello 123 World");
  });
});
