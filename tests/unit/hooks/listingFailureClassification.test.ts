import { describe, it, expect } from "vitest";
import { classifyListingFailure } from "@/src/hooks/listingFailureClassification";

describe("classifyListingFailure", () => {
  it.each([
    { isError: false, hasAnyPages: false, headFailed: false, nextPageFailed: false },
    { isError: false, hasAnyPages: true, headFailed: false, nextPageFailed: false },
    { isError: true, hasAnyPages: false, headFailed: true, nextPageFailed: false },
    { isError: true, hasAnyPages: true, headFailed: false, nextPageFailed: true },
  ])(
    "isError=$isError hasAnyPages=$hasAnyPages -> headFailed=$headFailed nextPageFailed=$nextPageFailed",
    ({ isError, hasAnyPages, headFailed, nextPageFailed }) => {
      expect(classifyListingFailure(isError, hasAnyPages)).toEqual({
        headFailed,
        nextPageFailed,
      });
    },
  );
});
