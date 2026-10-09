/**
 * Every string the reviews screen and the review editor (with its slip
 * preview) show. Lines marked approved were approved by the station verbatim;
 * the rest are drafted (the editor's from the Google Form's question wording)
 * and wait for the station's approval before launch.
 */
const joinNames = (names: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names);

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
  save: "Save",
  savedChange: "Saved.",
  couldNotSubmit: "Couldn't submit the review. Please try again.",
  couldNotDelete: "Couldn't delete the review. Please try again.",
  /** Shown when a submit finds the review already submitted; the editor reloads. */
  alreadySubmitted: "This review was already submitted.",
  submit: "Submit",
  /** Shown beside a disabled Submit. */
  submitNeedsReview: "Write the review before you submit it.",
  delete: "Delete",
  cancel: "Cancel",
  /** Above the form of a submitted review, for its author. */
  submittedBanner: "Submitted. You can keep editing; each saved change is kept in the review's history.",
  /** Submit's confirmation for a review of a logged record. */
  submitConfirmLogged: "Submit this review? The music directors will be emailed that it is ready. You can keep editing it afterwards.",
  /** Approved. Submit's confirmation for a review of a library release. */
  submitConfirmRelease: "Submit this review? It will appear on the record's page. You can keep editing it afterwards.",
  deleteConfirm: "Delete this review? Its history goes with it. This cannot be undone.",
  /** Approved. Shown beside a disabled Delete, and when a delete is refused. */
  inUse: "A music director is using this as the record's review. Ask them to remove it.",
  /** Shown to anyone but the author in place of the consent controls. */
  authorOnlyConsent: "Only the author can answer the publishing question.",
  /** A music director editing another person's review; the email clause only for a submitted review with a linked author. */
  editingOthers: (author: string, emailed: boolean) =>
    `You are editing ${author}'s review. Your change is saved under your name in the review's history${emailed ? ", and the author is emailed that it was edited." : "."}`,
  consent: {
    legend: "Where may this review be published?",
    website: "Website",
    apps: "WXYC apps",
    instagram: "Instagram",
    creditLegend: "How should we credit you?",
    djName: "DJ name",
    realName: "Real name",
    noName: "No name",
    notPublishedYet: "FCC notes are never published. Nothing is published yet; the station is collecting your answer for later.",
  },
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
    /** Shown on a checkout with a submitted review of mine. */
    reviewSubmitted: "Review submitted. A music director will choose the review for the cover.",
    editReview: "Edit review",
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
    /** Approved. Shown once the lists have reloaded after a cancel lost its race. */
    raceCancel: "This request was already answered, or it expired. The lists have been reloaded.",
    /** Approved. Shown once the lists have reloaded after the Checked out lane's release lost its race. */
    raceCheckoutReleased: "This record has already been returned. The lists have been reloaded.",
    cancelRequest: "Cancel request",
    release: "Release",
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
    /** The location line, on the Review waiting and Checked out lanes, for a checked-out record whose holder's account was removed. */
    holderRemovedNow: "Holder removed",
    /** The Review waiting lane's count, "1 review" or "2 reviews". */
    reviewOne: "review",
    reviewMany: "reviews",
    empty: "Nothing here.",
    /** Approved. The notice band's accessible name, over the recent passes. */
    recentPasses: "Recent passes",
    /** Approved. One line of the notice band: "Pat passed on Juana Molina — DOGA". */
    passedLine: (dj: string, artist: string, album: string) => `${dj} passed on ${artist} — ${album}`,
  },
  /** The music directors' page for one record, `/dashboard/admin/intake/{id}`. */
  intakeItem: {
    loadFailed: "Couldn't load this record. Please try again.",
    noCover: "No review chosen for the cover yet.",
    chooseFirst: "Choose a review for the cover before filing this record.",
    /** Followed by the names of DJs with an unfinished draft. */
    stillWriting: "Still writing:",
    notReviewed: "This record has no review chosen for the cover, so it can't be filed yet.",
    /** Approved. Shown once the record has reloaded after a filing lost its race. */
    alreadyFiled: "This record has already been filed. The page has been reloaded.",
    /** Approved. The heading over the form that files the record as new. */
    fileNew: "New to the library",
    /** Approved. The heading over the search for a record the library already has. */
    fileExisting: "Already in the library?",
    /** Approved. */
    searchLibrary: "Search the library",
    /** Approved. */
    search: "Search",
    /** Approved. */
    searchFailed: "Couldn't search the library. Please try again.",
    /** Approved. */
    fileOnto: "File it as this one",
    /** Approved. */
    fileFailed: "Couldn't file this record. Please try again.",
    /** Approved. Shown when the picked album names no library entry (the 400). */
    pickedGone: "That record is no longer in the library. Pick another, or file this one as new.",
    /** Approved. A search result, and the picked record beside the file button: "Juana Molina — DOGA (CD)". */
    recordLine: (artist: string, title: string, format: string) => `${artist} — ${title} (${format})`,
    printSlip: "Print the slip",
    filed: "Filed.",
    delete: "Delete",
    keep: "Cancel",
    deleteFailed: "Couldn't delete this record. Please try again.",
    /** Approved. The delete confirmation's title. */
    deleteTitle: (artist: string, album: string) => `Delete ${artist} — ${album} from the review shelf?`,
    /** Names are distinct, in first-appearance order. */
    deleteReviews: (names: string[]) =>
      names.length === 1 ? `This also deletes the submitted review by ${names[0]}.` : `This also deletes the submitted reviews by ${joinNames(names)}.`,
    /** Names are distinct, in first-appearance order. */
    deleteDrafts: (names: string[]) =>
      names.length === 1
        ? `It also deletes an unfinished draft by ${names[0]}. They have not submitted yet and will lose what they wrote.`
        : `It also deletes unfinished drafts by ${joinNames(names)}. They have not submitted yet and will lose what they wrote.`,
    deleteNoReviews: "No reviews have been written for it.",
    deleteFinal: "This cannot be undone.",
    deletedPlain: "Deleted.",
    /** Built from the response, not the confirmation. */
    deleted: (names: string[]) => `Deleted, with the reviews and drafts by ${joinNames(names)}.`,
  },
  /** The music directors' print page, `/dashboard/admin/intake/{id}/slip`. */
  intakeSlip: {
    /** Followed by a date. */
    lastPrinted: "Last printed",
    /** Follows the date and a period. */
    reprint: "Printing again replaces the slip on the cover.",
    noCover: "There is no review on the cover yet. Choose one on the record's page, then print.",
    backToRecord: "Back to the record's page",
    handwritten: "The record's review is handwritten, so it is already on the sleeve. There is nothing to print.",
  },
  /** The music directors' print page for one typed review of a library record, `/dashboard/admin/library/{albumId}/slip/{reviewId}`. */
  releaseSlip: {
    /** Names the review's author when there is one; a review that predates the in-app model has none, and the line drops the name clause. */
    lead: (author: string | null, artist: string, album: string) =>
      `This prints ${author ? `${author}'s` : "the"} review for the cover of ${artist} — ${album}. If the cover already has a slip, this one replaces it.`,
    /** Approved. */
    refused: "This review can't be printed. It may be handwritten, or it may have been deleted since the page opened.",
    backToAlbum: "Back to the album's page",
  },
  history: {
    link: "History",
    version: (n: number) => `Version ${n}`,
    editedBy: (name: string | null) => `edited by ${name ?? ""}`.trim(),
    submittedBy: (name: string | null) => `submitted by ${name ?? ""}`.trim(),
    current: "Current",
    onTheCover: "On the cover",
    draft: "This review has not been submitted yet, so it has no history.",
    loadFailed: "Couldn't load this review's history. Please try again.",
  },
  printedNote: {
    isCurrent: "This is the version printed on the cover.",
    edited: (printedOn: string) => `The cover has an earlier version of this review, printed ${printedOn}.`,
    seePrinted: "See the printed version",
    printNew: "Print a new slip",
    loadFailed: "Couldn't check which version is on the cover.",
  },
  myReviews: {
    title: "My reviews",
    empty: "You have not started a review.",
    draft: "Draft",
    submitted: "Submitted",
    open: "Open",
    libraryRelease: "A library release",
  },
  albumPanel: {
    /** Approved. */
    coverOne: "The review on the cover",
    /** Approved. */
    coverMany: "The reviews on the cover",
    /** Approved. */
    others: "Other reviews",
    /** Approved. Heading when no review is on the cover. */
    all: "Reviews",
    /** Approved. Shown for a handwritten review without text, beside its author. */
    onTheSleeve: "on the sleeve",
    /** Approved. Links to the review's history. */
    history: "Edited · see history",
    /** Approved. */
    reviewThisRelease: "Review this release",
    /** Approved. Sits beside the button. */
    nudge: "New to reviewing? New arrivals on the review shelf need reviews most.",
    archiveTitle: "Earlier takes",
    loadFailed: "Couldn't load the reviews. Please try again.",
    printReview: "Print this review",
  },
  /** FCC notes on a record, reported by any DJ. */
  fccNotes: {
    title: "FCC notes",
    empty: "No FCC notes for this record.",
    /** Followed by the reporter's name and ", not yet confirmed". */
    reportedBy: (reporter: string) => `Reported by ${reporter}, not yet confirmed`,
    confirmed: "Confirmed",
    report: "Report an FCC note",
    intro: "Heard something that can't go on air? Say which track and what's in it. Every DJ sees your note straight away, with your name. A music director will confirm it.",
    track: "Track",
    trackPlaceholder: "A2, or the track's name",
    note: "What's in it",
    needBoth: "Say which track and what's in it.",
    submit: "Report",
    cancel: "Cancel",
    couldNotReport: "Couldn't report the note. Please try again.",
    loadFailed: "Couldn't load the FCC notes. Please try again.",
  },
} as const;
