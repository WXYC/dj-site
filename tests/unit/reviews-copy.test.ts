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
    expect(REVIEW_COPY.intake.passedLineDated("Pat passed on Juana Molina — DOGA", "Oct 8")).toBe("Pat passed on Juana Molina — DOGA · Oct 8");
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

describe("REVIEW_COPY.intake digital choice", () => {
  it("pins the approved wording", () => {
    expect(REVIEW_COPY.intake.digital).toBe("Digital");
  });
});

describe("REVIEW_COPY digital album lines and the DJ's own list heading", () => {
  it.each([
    ["screen.checkoutsTitle", REVIEW_COPY.screen.checkoutsTitle, "Records I'm reviewing"],
    ["screen.checkoutsEmpty", REVIEW_COPY.screen.checkoutsEmpty, "You aren't reviewing any records."],
    ["screen.take", REVIEW_COPY.screen.take, "Take"],
    ["screen.notReviewedYet", REVIEW_COPY.screen.notReviewedYet, "Not reviewed yet"],
    ["screen.returnQuestionDigital", REVIEW_COPY.screen.returnQuestionDigital, "Put this record back on the review shelf? Another DJ can take it."],
    ["screen.filesComing", REVIEW_COPY.screen.filesComing, "A music director will send you the files."],
    ["screen.raceReleaseDigital", REVIEW_COPY.screen.raceReleaseDigital, "This record isn't yours to review any more. The lists have been reloaded."],
    ["subjectNotHeldDigital", REVIEW_COPY.subjectNotHeldDigital, "This record isn't yours to review any more, so a review can't be started here."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY.intake digital taken lines", () => {
  it.each([
    ["beingReviewed", REVIEW_COPY.intake.beingReviewed, "Being reviewed"],
    ["takenBy", REVIEW_COPY.intake.takenBy, "Taken by"],
    ["takenByRemoved", REVIEW_COPY.intake.takenByRemoved, "Taken by a removed account"],
    ["fromTaker", REVIEW_COPY.intake.fromTaker("Jessica Pratt"), "From Jessica Pratt, who has taken this record."],
    ["fromTakenBy", REVIEW_COPY.intake.fromTakenBy("Jessica Pratt", "DJ Sam"), "From Jessica Pratt. DJ Sam has taken the record."],
    [
      "fromTakenRemoved",
      REVIEW_COPY.intake.fromTakenRemoved("Jessica Pratt"),
      "From Jessica Pratt. The record was taken by an account that has since been removed.",
    ],
    ["checkedOut (a disc's chip)", REVIEW_COPY.intake.checkedOut, "Checked out"],
    ["screen.taken (a digital album's chip)", REVIEW_COPY.screen.taken, "Taken"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY editor and shelf copy the station approved on 2026-10-08", () => {
  const c = REVIEW_COPY;
  it.each([
    ["pageTitle", c.pageTitle, "Review"],
    ["draftPrivacy", c.draftPrivacy, "Only you can read this draft. Music directors can see that you have one in progress, not what it says."],
    ["saveDraft", c.saveDraft, "Save draft"],
    ["saved", c.saved, "Draft saved."],
    ["couldNotSave", c.couldNotSave, "Couldn't save the draft. Please try again."],
    ["couldNotLoad", c.couldNotLoad, "Couldn't load this review. Please try again."],
    ["fields.buzzwords.label", c.fields.buzzwords.label, "Buzzwords"],
    ["fields.buzzwords.help", c.fields.buzzwords.help, "A few words that sum up the record."],
    ["fields.review.label", c.fields.review.label, "Review"],
    ["fields.review.help", c.fields.review.help, "What you want a listener to know."],
    ["fields.recommended_tracks.label", c.fields.recommended_tracks.label, "Recommended tracks"],
    ["fields.recommended_tracks.help", c.fields.recommended_tracks.help, "Name tracks by side and position, like A1, B4."],
    ["fields.fcc.label", c.fields.fcc.label, "FCC"],
    ["fields.fcc.help", c.fields.fcc.help, "Optional. Anything on the record that is not safe to broadcast."],
    ["slip.name", c.slip.name, "Slip preview"],
    ["slip.artist", c.slip.artist, "Artist"],
    ["slip.album", c.slip.album, "Album"],
    ["slip.label", c.slip.label, "Label"],
    ["slip.review", c.slip.review, "Review"],
    ["slip.reviewer", c.slip.reviewer, "Reviewer"],
    ["slip.recommended", c.slip.recommended, "Recommended"],
    ["writeReview", c.writeReview, "Write a review"],
    ["couldNotStart", c.couldNotStart, "Couldn't start a review. Please try again."],
    ["myReviews.title", c.myReviews.title, "My reviews"],
    ["myReviews.empty", c.myReviews.empty, "You have not started a review."],
    ["myReviews.draft", c.myReviews.draft, "Draft"],
    ["myReviews.submitted", c.myReviews.submitted, "Submitted"],
    ["myReviews.open", c.myReviews.open, "Open"],
    ["myReviews.libraryRelease", c.myReviews.libraryRelease, "A library release"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
