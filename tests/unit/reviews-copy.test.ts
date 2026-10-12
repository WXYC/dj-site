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
    ["fileIt", c.fileIt, "File it"],
    ["deleteRecordHint", c.deleteRecordHint, "Delete this record only if it was logged by mistake. Its reviews and drafts go with it."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY.myReviews row", () => {
  it.each([
    ["fromTheLibrary", REVIEW_COPY.myReviews.fromTheLibrary, "from the library"],
    ["lastSaved", REVIEW_COPY.myReviews.lastSaved, "Last saved"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
