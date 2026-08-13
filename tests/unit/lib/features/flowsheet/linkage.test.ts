import { describe, it, expect } from "vitest";
import { hasLinkedAlbumId } from "@/lib/features/flowsheet/linkage";

describe("hasLinkedAlbumId", () => {
  it("is true for a positive album id", () => {
    expect(hasLinkedAlbumId(1001)).toBe(true);
  });

  it("is false for a synthesized negative id", () => {
    expect(hasLinkedAlbumId(-1)).toBe(false);
  });

  it("is false for zero", () => {
    expect(hasLinkedAlbumId(0)).toBe(false);
  });

  it("is false for null", () => {
    expect(hasLinkedAlbumId(null)).toBe(false);
  });

  it("is false for undefined", () => {
    expect(hasLinkedAlbumId(undefined)).toBe(false);
  });
});
