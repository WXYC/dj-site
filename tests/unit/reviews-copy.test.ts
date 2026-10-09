import { describe, expect, it } from "vitest";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("REVIEW_COPY.screen", () => {
  it("never calls the review shelf by its old name", () => {
    expect(JSON.stringify(REVIEW_COPY)).not.toMatch(/\b(pile|pool)\b/i);
  });
});

describe("REVIEW_COPY.intake passes band", () => {
  it("pins the approved wording", () => {
    expect(REVIEW_COPY.intake.recentPasses).toBe("Recent passes");
    expect(REVIEW_COPY.intake.passedLine("Pat", "Juana Molina", "DOGA")).toBe("Pat passed on Juana Molina — DOGA");
  });
});

describe("REVIEW_COPY.intakeItem filing onto a record the library has", () => {
  const c = REVIEW_COPY.intakeItem;
  it.each([
    ["fileNew", c.fileNew, "New to the library"],
    ["fileExisting", c.fileExisting, "Already in the library?"],
    ["searchLibrary", c.searchLibrary, "Search the library"],
    ["search", c.search, "Search"],
    ["fileOnto", c.fileOnto, "File it as this one"],
    ["searchFailed", c.searchFailed, "Couldn't search the library. Please try again."],
    ["pickedGone", c.pickedGone, "That record is no longer in the library. Pick another, or file this one as new."],
    ["fileFailed", c.fileFailed, "Couldn't file this record. Please try again."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("formats a record as artist, title and format", () => {
    expect(c.recordLine("Juana Molina", "DOGA", "CD")).toBe("Juana Molina — DOGA (CD)");
  });
});
