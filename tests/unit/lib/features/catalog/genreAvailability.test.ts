import { describe, it, expect } from "vitest";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";

describe("isGenresUnavailable", () => {
  it("is not unavailable while the initial load is still in flight", () => {
    expect(isGenresUnavailable(true, undefined)).toBe(false);
  });

  it("is unavailable once loading settles with no data", () => {
    expect(isGenresUnavailable(false, undefined)).toBe(true);
    expect(isGenresUnavailable(false, null)).toBe(true);
  });

  it("is not unavailable once a list has arrived", () => {
    expect(isGenresUnavailable(false, [{ id: 1, genre_name: "Rock" }])).toBe(false);
  });

  it("is not unavailable while an empty-but-present list is cached", () => {
    // An empty array is a real, successfully-fetched answer — distinct from
    // `null`/`undefined`, which mean no answer was ever received.
    expect(isGenresUnavailable(false, [])).toBe(false);
  });
});
