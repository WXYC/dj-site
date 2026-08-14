import { describe, it, expect } from "vitest";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";

describe("isGenresUnavailable", () => {
  it("is not unavailable while the query is skipped and no request exists", () => {
    // A skipped query settles at `isLoading: false` with no data — the same
    // shape as an outage, distinguished only by `isUninitialized`.
    expect(
      isGenresUnavailable({ isUninitialized: true, isLoading: false, data: undefined }),
    ).toBe(false);
  });

  it("is not unavailable while the initial load is still in flight", () => {
    expect(
      isGenresUnavailable({ isUninitialized: false, isLoading: true, data: undefined }),
    ).toBe(false);
  });

  it.each([
    ["a load that never produced data", undefined],
    // `null` is the shared base query's non-JSON soft-fail payload replacing
    // the cache, not a hypothetical: the predicate's loose nullish check
    // exists to catch it.
    ["a non-JSON soft-fail that replaced the cache", null],
  ])("is unavailable once loading settles with %s", (_name, data) => {
    expect(isGenresUnavailable({ isUninitialized: false, isLoading: false, data })).toBe(
      true,
    );
  });

  it("is not unavailable once a list has arrived", () => {
    const genres: readonly { id: number; genre_name: string }[] = [
      { id: 1, genre_name: "Rock" },
    ];
    expect(
      isGenresUnavailable({ isUninitialized: false, isLoading: false, data: genres }),
    ).toBe(false);
  });

  it("is not unavailable while an empty-but-present list is cached", () => {
    // An empty array is a real, successfully-fetched answer — distinct from
    // `null`/`undefined`, which mean no answer was ever received.
    expect(
      isGenresUnavailable({ isUninitialized: false, isLoading: false, data: [] }),
    ).toBe(false);
  });
});
