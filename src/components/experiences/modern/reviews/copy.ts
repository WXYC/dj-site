/**
 * Every string the reviews screen and the review editor (with its slip
 * preview) show. Lines marked approved were approved by the station verbatim;
 * the rest are drafted (the editor's from the Google Form's question wording)
 * and wait for the station's approval before launch.
 */
/** "A", "A and B", "A, B and C": no comma before "and", and no dependence on the runtime's locale data. */
const joinNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

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
  /** Approved. */
  save: "Save",
  /** Approved. */
  savedChange: "Saved.",
  /** Approved. */
  couldNotSubmit: "Couldn't submit the review. Please try again.",
  /** Approved. */
  couldNotDelete: "Couldn't delete the review. Please try again.",
  /** Approved. Shown when a submit finds the review already submitted; the editor reloads. */
  alreadySubmitted: "This review was already submitted.",
  /** Approved. */
  submit: "Submit",
  /** Approved. Shown beside a disabled Submit. */
  submitNeedsReview: "Write the review before you submit it.",
  /** Approved. */
  delete: "Delete",
  /** Approved. */
  cancel: "Cancel",
  /** Approved. Above the form of a submitted review, for its author. */
  submittedBanner: "Submitted. You can keep editing; each saved change is kept in the review's history.",
  /** Approved. Submit's confirmation for a review of a logged record. */
  submitConfirmLogged: "Submit this review? The music directors will be emailed that it is ready. You can keep editing it afterwards.",
  /** Approved. Submit's confirmation for a review of a library release. */
  submitConfirmRelease: "Submit this review? It will appear on the record's page. You can keep editing it afterwards.",
  /** Approved. */
  deleteConfirm: "Delete this review? Its history goes with it. This cannot be undone.",
  /** Approved. Shown beside a disabled Delete, and when a delete is refused. */
  inUse: "A music director is using this as the record's review. Ask them to remove it.",
  /** Approved. Shown to anyone but the author in place of the consent controls. */
  authorOnlyConsent: "Only the author can answer the publishing question.",
  /** Approved. A music director editing another person's review; the email clause only for a submitted review with a linked author. */
  editingOthers: (author: string, emailed: boolean) =>
    `You are editing ${author}'s review. Your change is saved under your name in the review's history${emailed ? ", and the author is emailed that it was edited." : "."}`,
  consent: {
    /** Approved. */
    legend: "Where may this review be published?",
    /** Approved. */
    website: "Website",
    /** Approved. */
    apps: "WXYC apps",
    /** Approved. */
    instagram: "Instagram",
    /** Approved. */
    creditLegend: "How should we credit you?",
    /** Approved. */
    djName: "DJ name",
    /** Approved. */
    realName: "Real name",
    /** Approved. */
    noName: "No name",
    /** Approved. */
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
    /** Approved. */
    checkoutsTitle: "My checkouts",
    /** Approved. */
    checkoutsEmpty: "You have no records checked out.",
    /** Approved. */
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
    /** Approved. Shown on a checkout whose review is done. */
    reviewedReturn: "Reviewed. Bring the record back to the music office.",
    /** Approved. Shown on a checkout with a submitted review of mine. */
    reviewSubmitted: "Review submitted. A music director will choose the review for the cover.",
    /** Approved. */
    editReview: "Edit review",
    /** Approved. Each is followed by a date. */
    logged: "Logged",
    /** Approved. */
    taken: "Taken",
    /** Approved. */
    asked: "Asked",
    /** Approved. */
    checkOut: "Check out",
    /** Approved. */
    accept: "Accept",
    /** Approved. */
    pass: "Pass",
    /** Approved. */
    cancel: "Cancel",
    /** Approved. Lost races, shown once the lists have reloaded. */
    raceCheckout: "This record left the review shelf before your click went through. The lists have been reloaded.",
    /** Approved. Accept and Pass share it. */
    raceRequest: "This request is no longer open; it may have expired. The lists have been reloaded.",
    /** Approved. */
    raceRelease: "This record is no longer checked out to you. The lists have been reloaded.",
  },
  /** The strip over the Reviews page's two tabs. */
  tabs: {
    /** Approved. */
    reviewing: "Reviewing",
    /** Approved. */
    directors: "Music directors",
    /** Approved. The label, then the number of reviews waiting, as `Music directors (3)`. */
    count: (label: string, n: number) => `${label} (${n})`,
  },
  /** The sidebar's one entry for the Reviews page. */
  sidebar: {
    /** Approved. */
    title: "Reviews",
  },
  /** The music directors' lanes, on the Reviews page's second tab. */
  intake: {
    /** Approved. The heading and tab title of a record's page under the music directors' admin area; it is not a menu entry (the sidebar reads `sidebar.title`). */
    title: "Review shelf",
    /** Approved. Shown once the lists have reloaded after Mark as returned lost a race. */
    raceReleased: "This record has already been returned or filed. The lists have been reloaded.",
    /** Approved. Shown once the lists have reloaded after a cancel lost its race. */
    raceCancel: "This request was already answered, or it expired. The lists have been reloaded.",
    /** Approved. Shown once the lists have reloaded after the Checked out lane's release lost its race. */
    raceCheckoutReleased: "This record has already been returned. The lists have been reloaded.",
    /** Approved. */
    cancelRequest: "Cancel request",
    /** Approved. */
    release: "Release",
    /** Approved. Shown once the lists have reloaded after a request lost its race. */
    raceRequest: "This record has left the review shelf since the page loaded, so it can't be requested. The lists have been reloaded.",
    /** Approved. Shown when a request names an account that can no longer be asked to review. */
    requestRefused: "That DJ can't be asked to review: their account was removed, or it's no longer a DJ account. Pick someone else.",
    /** Approved. */
    djToAsk: "DJ to ask",
    /** Approved. */
    request: "Request a review",
    /** Approved. */
    reviewersLoadFailed: "Couldn't load the DJs who can be asked to review. Please try again.",
    /** Approved. */
    logTitle: "Log an item",
    /** Approved. */
    artist: "Artist",
    /** Approved. */
    album: "Album",
    /** Approved. */
    label: "Label",
    /** Approved. */
    format: "Format",
    /** Approved. */
    discogsReleaseId: "Discogs release id (optional)",
    /** Approved. */
    log: "Log item",
    /** Approved. */
    waiting: "Review waiting",
    /** Approved. */
    onShelf: "On the review shelf",
    /** Approved. */
    requested: "Requested",
    /** Approved. */
    checkedOut: "Checked out",
    /** Approved. Each is followed by a DJ name. */
    heldFor: "Held for",
    /** Approved. */
    checkedOutTo: "Checked out to",
    /** Approved. */
    reviewed: "Reviewed",
    /** Approved. */
    filed: "Filed",
    /** Approved. The small mark on a row in a physical lane whose record also has a review waiting. */
    reviewWaitingMark: "review waiting",
    /** Approved. */
    returned: "Mark as returned",
    /** Approved. Followed by the holder's name. */
    stillOutTo: "Still out: checked out to",
    /** Approved. */
    holderRemoved: "Still out: holder removed",
    /** Approved. The location line, on the Review waiting and Checked out lanes, for a checked-out record whose holder's account was removed. */
    holderRemovedNow: "Holder removed",
    /** Approved. Who a waiting review is from, when its author is the DJ who has the record. */
    fromHolder: (author: string) => `From ${author}, who has this record.`,
    /** Approved. Someone else wrote it and a named DJ has the record. */
    fromWith: (author: string, holder: string) => `From ${author}. The record is with ${holder}.`,
    /** Approved. Someone else wrote it and a music director's request to a DJ is still open. */
    fromHeldFor: (author: string, holder: string) => `From ${author}. The record is being held for ${holder}.`,
    /** Approved. Someone else wrote it and the record is on the review shelf. */
    fromShelf: (author: string) => `From ${author}. The record is on the review shelf.`,
    /** Approved. Someone else wrote it and the holder's account was removed. */
    fromRemoved: (author: string) => `From ${author}. The record is checked out; holder removed.`,
    /** Approved. The further waiting reviews on a Review waiting row. */
    more: (n: number) => `+${n} more`,
    /** Approved. */
    empty: "Nothing here.",
    /** Approved. The notice band's accessible name, over the recent passes. */
    recentPasses: "Recent passes",
    /** Approved. One line of the notice band: "Pat passed on Juana Molina — DOGA". */
    passedLine: (dj: string, artist: string, album: string) => `${dj} passed on ${artist} — ${album}`,
  },
  /** The music directors' page for one record, `/dashboard/admin/intake/{id}`. */
  intakeItem: {
    /** Approved. */
    loadFailed: "Couldn't load this record. Please try again.",
    /** Approved. */
    noCover: "No review chosen for the cover yet.",
    /** Approved. */
    chooseFirst: "Choose a review for the cover before filing this record.",
    /** Approved. Followed by the names of DJs with an unfinished draft. */
    stillWriting: "Still writing:",
    /** Approved. */
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
    /** Approved. */
    printSlip: "Print the slip",
    /** Approved. */
    filed: "Filed.",
    /** Approved. */
    delete: "Delete",
    /** Approved. */
    keep: "Cancel",
    /** Approved. */
    deleteFailed: "Couldn't delete this record. Please try again.",
    /** Approved. The delete confirmation's title. */
    deleteTitle: (artist: string, album: string) => `Delete ${artist} — ${album} from the review shelf?`,
    /** Approved. Names are distinct, in first-appearance order. */
    deleteReviews: (names: string[]) =>
      names.length === 1 ? `This also deletes the submitted review by ${names[0]}.` : `This also deletes the submitted reviews by ${joinNames(names)}.`,
    /** Approved. Names are distinct, in first-appearance order. */
    deleteDrafts: (names: string[]) =>
      names.length === 1
        ? `It also deletes an unfinished draft by ${names[0]}. They have not submitted yet and will lose what they wrote.`
        : `It also deletes unfinished drafts by ${joinNames(names)}. They have not submitted yet and will lose what they wrote.`,
    /** Approved. */
    deleteNoReviews: "No reviews have been written for it.",
    /** Approved. */
    deleteFinal: "This cannot be undone.",
    /** Approved. */
    deletedPlain: "Deleted.",
    /** Approved. Built from the response, not the confirmation. */
    deleted: (names: string[]) => `Deleted, with the reviews and drafts by ${joinNames(names)}.`,
  },
  /** The music directors' print page, `/dashboard/admin/intake/{id}/slip`. */
  intakeSlip: {
    /** Approved. Followed by a date. */
    lastPrinted: "Last printed",
    /** Approved. Follows the date and a period. */
    reprint: "Printing again replaces the slip on the cover.",
    /** Approved. */
    noCover: "There is no review on the cover yet. Choose one on the record's page, then print.",
    /** Approved. */
    backToRecord: "Back to the record's page",
    /** Approved. */
    handwritten: "The record's review is handwritten, so it is already on the sleeve. There is nothing to print.",
  },
  /** The music directors' print page for one typed review of a library record, `/dashboard/admin/library/{albumId}/slip/{reviewId}`. */
  releaseSlip: {
    /** Approved. Names the review's author when there is one; a review that predates the in-app model has none, and the line drops the name clause. */
    lead: (author: string | null, artist: string, album: string) =>
      `This prints ${author ? `${author}'s` : "the"} review for the cover of ${artist} — ${album}. If the cover already has a slip, this one replaces it.`,
    /** Approved. */
    refused: "This review can't be printed. It may be handwritten, or it may have been deleted since the page opened.",
    /** Approved. */
    backToAlbum: "Back to the album's page",
  },
  history: {
    /** Approved. */
    link: "History",
    /** Approved. */
    version: (n: number) => `Version ${n}`,
    /** Approved. */
    editedBy: (name: string | null) => `edited by ${name ?? ""}`.trim(),
    /** Approved. */
    submittedBy: (name: string | null) => `submitted by ${name ?? ""}`.trim(),
    /** Approved. */
    current: "Current",
    /** Approved. */
    onTheCover: "On the cover",
    /** Approved. */
    draft: "This review has not been submitted yet, so it has no history.",
    /** Approved. */
    loadFailed: "Couldn't load this review's history. Please try again.",
  },
  printedNote: {
    /** Approved. */
    isCurrent: "This is the version printed on the cover.",
    /** Approved. */
    edited: (printedOn: string) => `The cover has an earlier version of this review, printed ${printedOn}.`,
    /** Approved. */
    seePrinted: "See the printed version",
    /** Approved. */
    printNew: "Print a new slip",
    /** Approved. */
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
    /** Approved. */
    archiveTitle: "Earlier takes",
    /** Approved. */
    loadFailed: "Couldn't load the reviews. Please try again.",
  },
  /** FCC notes on a record, reported by any DJ. */
  fccNotes: {
    /** Approved. */
    title: "FCC notes",
    /** Approved. */
    empty: "No FCC notes for this record.",
    /** Approved. Followed by the reporter's name and ", not yet confirmed". */
    reportedBy: (reporter: string) => `Reported by ${reporter}, not yet confirmed`,
    /** Approved. */
    confirmed: "Confirmed",
    /** Approved. */
    report: "Report an FCC note",
    /** Approved. */
    intro: "Heard something that can't go on air? Say which track and what's in it. Every DJ sees your note straight away, with your name. A music director will confirm it.",
    /** Approved. */
    track: "Track",
    /** Approved. */
    trackPlaceholder: "A2, or the track's name",
    /** Approved. */
    note: "What's in it",
    /** Approved. */
    needBoth: "Say which track and what's in it.",
    /** Approved. */
    submit: "Report",
    /** Approved. */
    cancel: "Cancel",
    /** Approved. */
    couldNotReport: "Couldn't report the note. Please try again.",
    /** Approved. */
    loadFailed: "Couldn't load the FCC notes. Please try again.",
    /** Approved. Button on a note a music director may act on. */
    confirm: "Confirm",
    /** Approved. Button on a note a music director may act on. */
    remove: "Remove",
    /** Approved. Asked before a music director removes a note nobody has confirmed. */
    removeQuestion: (reporter: string) => `Remove this note? ${reporter} reported it.`,
    /** Approved. Asked before a music director removes a confirmed note. */
    removeConfirmedQuestion: "Remove this confirmed note? It will no longer be printed on the slip.",
    /** Approved. Shown once after a music director confirms a note. */
    reprint: "Confirmed notes are printed on the slip. If this record's slip is already on the cover, print the slip again to replace it.",
    /** Approved. Button on a DJ's own note while nobody has confirmed it. */
    removeMine: "Remove my note",
    /** Approved. The question `removeMine` asks. */
    removeMineQuestion: "Remove your note?",
    /** Approved. Shown to the reporter when a music director confirmed the note while they were taking it back. */
    confirmedByMd: "A music director has confirmed this note, so only they can remove it.",
    /** Approved. Heading of the waiting list; the number is how many notes are waiting. */
    toConfirmTitle: (count: number) => `FCC notes to confirm (${count})`,
    /** Approved. A waiting-list row's record, which links to it. */
    toConfirmRecord: (artist: string, album: string) => `${artist} — ${album}`,
    /** Approved. A waiting-list row's track and note. */
    toConfirmNote: (track: string, note: string) => `${track}: ${note}`,
    /** Approved. Who reported a waiting-list note and when; the date is the station's long date. */
    toConfirmReportedOn: (reporter: string, date: string) => `Reported by ${reporter} on ${date}`,
    /** Approved. Spoken name of Confirm on a waiting-list row; the visible word stays `Confirm`. */
    toConfirmSpokenConfirm: (artist: string, album: string, track: string) =>
      `Confirm the note on ${artist} — ${album}, ${track}`,
    /** Approved. Spoken name of Remove on a waiting-list row; the visible word stays `Remove`. */
    toConfirmSpokenRemove: (artist: string, album: string, track: string) =>
      `Remove the note on ${artist} — ${album}, ${track}`,
    /** Approved. */
    toConfirmLoadFailed: "Couldn't load the FCC notes to confirm. Please try again.",
    /** Approved. */
    couldNotConfirm: "Couldn't confirm the note. Please try again.",
    /** Approved. */
    couldNotRemove: "Couldn't remove the note. Please try again.",
  },
} as const;
