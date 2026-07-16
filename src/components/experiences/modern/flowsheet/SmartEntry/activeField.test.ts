import { describe, it, expect } from "vitest";
import { parseSmartEntry } from "./parser/parseSmartEntry";
import { activeFieldAtEnd } from "./activeField";

const active = (raw: string) => activeFieldAtEnd(parseSmartEntry(raw));

describe("activeFieldAtEnd", () => {
  it("defaults to song for empty input", () => {
    expect(active("")).toBe("song");
  });

  it("is song while typing the leading title", () => {
    expect(active("Percolator")).toBe("song");
  });

  it("follows a trailing trigger awaiting a value", () => {
    expect(active("Percolator by ")).toBe("artist");
    expect(active("Percolator on ")).toBe("album");
  });

  it("is the last completed field when mid-typing its value", () => {
    expect(active("Percolator by Stereo")).toBe("artist");
    expect(active("Percolator by Stereolab on Dots")).toBe("album");
  });

  it("stays on the song across a literal semicolon (not a separator)", () => {
    expect(active("Percolator; Stereo")).toBe("song");
  });
});
