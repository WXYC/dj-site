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
    ["screen.take", REVIEW_COPY.screen.take, "Take"],
    ["screen.notReviewedYet", REVIEW_COPY.screen.notReviewedYet, "Not reviewed yet"],
    ["screen.returnQuestionDigital", REVIEW_COPY.screen.returnQuestionDigital, "Put this record back on the review shelf? Another DJ can take it."],
    ["screen.filesComing", REVIEW_COPY.screen.filesComing, "A music director will send you the files."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY.intake the stage name and date fact a disc and a digital album share", () => {
  it.each([
    ["beingReviewed", REVIEW_COPY.intake.beingReviewed, "Being reviewed"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("has no Checked out or Taken entry: Reviewing since is the one date fact, for a disc and a digital album alike", () => {
    expect(REVIEW_COPY.intake).not.toHaveProperty("checkedOut");
    expect(REVIEW_COPY.screen).not.toHaveProperty("taken");
    expect(REVIEW_COPY.screen.reviewingSince).toBe("Reviewing since");
  });
});

describe("REVIEW_COPY round 10, the lines a disc and a digital album now share", () => {
  const i = REVIEW_COPY.intake;
  it.each([
    ["tabs.directors", REVIEW_COPY.tabs.directors, "New music"],
    ["screen.added", REVIEW_COPY.screen.added, "Added"],
    ["screen.reviewingSince", REVIEW_COPY.screen.reviewingSince, "Reviewing since"],
    ["subjectNotHeld", REVIEW_COPY.subjectNotHeld, "This record is no longer yours to review, so a review can't be started here."],
    ["screen.raceRelease", REVIEW_COPY.screen.raceRelease, "This record is no longer yours to review. The lists have been reloaded."],
    ["intake.with", i.with, "With"],
    ["intake.withRemoved", i.withRemoved, "With a removed account"],
    ["intake.stillWith", i.stillWith, "Still with"],
    ["intake.stillWithRemoved", i.stillWithRemoved, "Still with a removed account"],
    ["intake.fromHolder", i.fromHolder("Jessica Pratt"), "From Jessica Pratt, who has this record."],
    ["intake.fromWith", i.fromWith("Jessica Pratt", "DJ Sam"), "From Jessica Pratt. The record is with DJ Sam."],
    ["intake.fromRemoved", i.fromRemoved("Jessica Pratt"), "From Jessica Pratt. The record is with a removed account."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY round 10, digitizing and copying a review", () => {
  const r = REVIEW_COPY.record;
  const x = REVIEW_COPY.intakeItem;
  it.each([
    ["title", r.title, "Digitize a review"],
    ["copyTitle", r.copyTitle, "Copy from Google Forms"],
    ["digitized", r.digitized, "Digitized."],
    ["copied", r.copied, "Copied."],
    ["couldNotSave", r.couldNotSave, "Couldn't save the review. Please try again."],
    ["copiedFromForm", r.copiedFromForm, "Copied from Google Forms. Check it, then save."],
    ["copiedNoName", r.copiedNoName, "Copied from Google Forms. Check it, add the reviewer's name, then save."],
    ["byHand", r.byHand, "This review exists only on paper. Copy this record's slip by hand, then digitize it here."],
    [
      "emailed",
      r.emailed("Sam"),
      "Sam will be emailed that their review is now in the DJ site. They can edit it and answer the publishing question themselves.",
    ],
    ["formAfterCutover", x.formAfterCutover, "Copied. The record can't cite this form review: it was sent in after the cutover date."],
    ["formNoDate", x.formNoDate, "Copied. The record can't cite this form review: it has no date."],
    [
      "deleteCoverRemoved",
      x.deleteCoverRemoved,
      "This is the review on the cover. Deleting it puts the record back with its holder, whose account was removed.",
    ],
    ["formNotNoted", x.formNotNoted, "Copied. Couldn't note which form review it came from."],
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
    ["myReviews.draft", c.myReviews.draft, "Draft"],
    ["myReviews.submitted", c.myReviews.submitted, "Submitted"],
    ["myReviews.open", c.myReviews.open, "Open"],
    ["myReviews.libraryRelease", c.myReviews.libraryRelease, "A library release"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY Add a record, the button, the dialog and what it says after an add", () => {
  const i = REVIEW_COPY.intake;
  it.each([
    ["logTitle", i.logTitle, "Add a record"],
    ["log", i.log, "Add a record"],
    ["newMusicLine", i.newMusicLine, "Every new record, from arrival to filing."],
    ["addRecordLine", i.addRecordLine, "It goes on the review shelf, where any DJ can choose to review it."],
    ["addedLine", i.addedLine("Cat Power", "Moon Pix"), "Added Moon Pix by Cat Power."],
    ["addAnother", i.addAnother, "Add another"],
    ["addDone", i.addDone, "Done"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY round 10, the More menu on a music director's review shelf row", () => {
  const i = REVIEW_COPY.intake;
  it.each([
    ["moreButton", i.moreButton, "More"],
    ["askADj", i.askADj, "Ask a DJ…"],
    ["moreCite", i.moreCite, "Use a review we already have…"],
    ["moreRecord", i.moreRecord, "Digitize a review…"],
    ["moreAskDescription", i.moreAskDescription, "Held for them for 7 days."],
    ["moreCiteDescription", i.moreCiteDescription, "From the copy in the library, or a form review."],
    ["moreRecordDescription", i.moreRecordDescription, "Type in a review that's on paper."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY request lines", () => {
  it.each([
    ["requestedBy", REVIEW_COPY.screen.requestedBy("Mike", "Oct 16"), "Mike requested your review on Oct 16."],
    ["requestedNoAsker", REVIEW_COPY.screen.requestedNoAsker("Oct 16"), "Your review was requested on Oct 16."],
    ["heldForAskedBy", REVIEW_COPY.intake.heldForAskedBy("DJ Pat", "Mike"), "Held for DJ Pat, asked by Mike"],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("REVIEW_COPY.intake Bandcamp field the station approved on 2026-10-16", () => {
  it.each([
    ["bandcampUrl", REVIEW_COPY.intake.bandcampUrl, "Bandcamp link (optional)"],
    ["bandcampRefused", REVIEW_COPY.intake.bandcampRefused, "That isn't a Bandcamp link."],
  ])("pins %s", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
