/**
 * Every string the review editor, its slip preview, and the screen's draft
 * rows show. The two lines marked approved were approved by the station
 * verbatim; the rest are drafted from the Google Form's question wording and
 * wait for the station's approval before launch.
 */
export const REVIEW_COPY = {
  /** Approved. Shown in place of a draft the DJ can no longer start. */
  subjectNotHeld: "You no longer have this record checked out, so a review can't be started here.",
  /** Approved. Shown in place of the editor while reviews are open to music directors only. */
  staffOnly: "Reviews are open to music directors for now. You'll be able to open this review when they open to every DJ.",
  /** The editor page's header and browser-tab title. */
  pageTitle: "Review",
  /** Shown above the fields of a draft only; a submitted review is no longer private. */
  draftPrivacy: "Only you can read this draft. Music directors can see that you have one in progress, not what it says.",
  writeReview: "Write a review",
  couldNotStart: "Couldn't start a review. Please try again.",
  saveDraft: "Save draft",
  saved: "Draft saved.",
  couldNotSave: "Couldn't save the draft. Please try again.",
  couldNotLoad: "Couldn't load this review. Please try again.",
  fields: {
    buzzwords: { label: "Buzzwords", help: "A few words that sum up the record." },
    artist_blurb: { label: "About the artist", help: "A short paragraph on who made it." },
    review: { label: "Review", help: "What you want a listener to know." },
    recommended_tracks: { label: "Recommended tracks", help: "Name tracks by side and position, like A1, B4." },
    fcc: { label: "FCC", help: "Optional. Anything on the record that is not safe to broadcast." },
  },
  /**
   * The printed slip's own row labels, which follow the station's paper slip
   * rather than the editor's field labels. The Buzzwords and FCC rows reuse
   * the field labels above.
   */
  slip: {
    /** The preview's accessible name. */
    name: "Slip preview",
    artist: "Artist",
    album: "Album",
    label: "Label",
    /** The artist paragraph's row. */
    artistBlurb: "Artist",
    review: "Review",
    reviewer: "Reviewer",
    recommended: "Recommended",
  },
  myReviews: {
    title: "My reviews",
    empty: "You have not started a review.",
    draft: "Draft",
    submitted: "Submitted",
    open: "Open",
    libraryRelease: "A library release",
  },
} as const;
