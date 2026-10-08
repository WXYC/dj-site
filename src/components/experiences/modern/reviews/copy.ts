/**
 * Every string the reviews screen and the review editor (with its slip
 * preview) show. Lines marked approved were approved by the station verbatim;
 * the rest are drafted (the editor's from the Google Form's question wording)
 * and wait for the station's approval before launch.
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
  screen: {
    /** Approved. */
    shelfTitle: "The review shelf",
    /** Approved. */
    shelfEmpty: "Nothing is waiting on the review shelf.",
    checkoutsTitle: "My checkouts",
    /** Approved. */
    checkoutsEmpty: "You have no records checked out.",
    requestsTitle: "Requests for me",
    /** Approved. */
    requestsEmpty: "No one has asked you for a review.",
    /** Approved. The page's load failure. */
    loadFailed: "Couldn't load the review shelf. Please try again.",
    /** Approved. Any failed write other than starting a review. */
    writeFailed: "Couldn't do that. Please try again.",
    /** Approved. */
    overdue: "Overdue",
    /** Approved. The button and the confirm dialog's title. */
    returnToShelf: "Return to the review shelf",
    /** Approved. The confirm dialog's question. */
    returnQuestion: "Have you brought this record back to the station?",
    /** Shown on a checkout whose review is done. */
    reviewedReturn: "Reviewed. Bring the record back to the music office.",
    /** Each is followed by a date. */
    logged: "Logged",
    taken: "Taken",
    asked: "Asked",
    checkOut: "Check out",
    accept: "Accept",
    pass: "Pass",
    cancel: "Cancel",
    /** Approved. Lost races, shown once the lists have reloaded. */
    raceCheckout: "This record left the review shelf before your click went through. The lists have been reloaded.",
    /** Approved. Accept and Pass share it. */
    raceRequest: "This request is no longer open; it may have expired. The lists have been reloaded.",
    /** Approved. */
    raceRelease: "This record is no longer checked out to you. The lists have been reloaded.",
  },
  /** The music directors' review shelf page, `/dashboard/admin/intake`. */
  intake: {
    /** Approved. The menu entry and the page heading. */
    title: "Review shelf",
    /** Approved. Shown once the lists have reloaded after Mark as returned lost a race. */
    raceReleased: "This record has already been returned or filed. The lists have been reloaded.",
    logTitle: "Log an item",
    artist: "Artist",
    album: "Album",
    label: "Label",
    format: "Format",
    discogsReleaseId: "Discogs release id (optional)",
    log: "Log item",
    waiting: "Review waiting",
    onShelf: "On the review shelf",
    requested: "Requested",
    checkedOut: "Checked out",
    /** Each is followed by a DJ name. */
    heldFor: "Held for",
    checkedOutTo: "Checked out to",
    reviewed: "Reviewed",
    filed: "Filed",
    /** The small mark on a row in a physical lane whose record also has a review waiting. */
    reviewWaitingMark: "review waiting",
    returned: "Mark as returned",
    /** Followed by the holder's name. */
    stillOutTo: "Still out: checked out to",
    holderRemoved: "Still out: holder removed",
    empty: "Nothing here.",
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
