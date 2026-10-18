/**
 * Every string the reviews screen and the review editor (with its slip
 * preview) show. Every string is marked approved: the station approved them
 * verbatim (the editor's were drafted from the Google Form's question wording
 * and approved on 2026-10-08, with no changes). A string added later stays
 * unmarked until the station approves it.
 */
/** "A", "A and B", "A, B and C": no comma before "and", and no dependence on the runtime's locale data. */
const joinNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export const REVIEW_COPY = {
  /** Approved. Shown in place of a draft the DJ can no longer start. */
  subjectNotHeld: "This record is no longer yours to review, so a review can't be started here.",
  /** Approved. Shown in place of the editor while reviews are open to music directors only. */
  staffOnly: "Reviews are open to music directors for now. You'll be able to open this review when they open to every DJ.",
  /** Approved. The editor's visually hidden heading and browser-tab title. */
  pageTitle: "Review",
  /** Approved. Shown above the fields of a draft only; a submitted review is no longer private. */
  draftPrivacy: "Only you can read this draft. Music directors can see that you have one in progress, not what it says.",
  /** Approved. */
  writeReview: "Write a review",
  /** Approved. */
  couldNotStart: "Couldn't start a review. Please try again.",
  /** The editor's line above the form after Write a review on a request. */
  arrived: {
    /** Approved. */
    disc: "It's yours to review now, so other DJs can see that you have it. Write when you've listened; your draft saves here.",
    /** Approved. */
    digital: "It's yours to review now, and the music directors have been told to send you the files. Write when you've listened; your draft saves here.",
  },
  /** Approved. */
  saveDraft: "Save draft",
  /** Approved. */
  saved: "Draft saved.",
  /** Approved. */
  couldNotSave: "Couldn't save the draft. Please try again.",
  /** Approved. */
  couldNotLoad: "Couldn't load this review. Please try again.",
  /** Approved. */
  save: "Save",
  /** Approved. Beside Save while nothing has changed since the last save or since the review loaded. */
  allChangesSaved: "All changes saved",
  /** Approved. Beside Save once something has changed, and while the offer to restore kept text stands. */
  unsavedChanges: "Unsaved changes",
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
    /** Approved. */
    buzzwords: { label: "Buzzwords", help: "A few words that sum up the record." },
    /** Approved. */
    review: { label: "Review", help: "What you want a listener to know." },
    /** Approved. */
    recommended_tracks: { label: "Recommended tracks", help: "Name tracks by side and position, like A1, B4." },
    /** Approved. */
    fcc: { label: "FCC", help: "Optional. Anything on the record that is not safe to broadcast." },
  },
  /**
   * The printed slip's own row labels, which follow the station's paper slip
   * rather than the editor's field labels. The Buzzwords and FCC rows reuse
   * the field labels above.
   */
  slip: {
    /** Approved. The preview's accessible name. */
    name: "Slip preview",
    /** Approved. */
    artist: "Artist",
    /** Approved. */
    album: "Album",
    /** Approved. */
    label: "Label",
    /** Approved. */
    review: "Review",
    /** Approved. */
    reviewer: "Reviewer",
    /** Approved. */
    recommended: "Recommended",
    /** Approved. The heading over the editor's slip preview. */
    heading: "As it will print",
  },
  screen: {
    /** Approved. */
    shelfTitle: "The review shelf",
    /** Approved. */
    shelfEmpty: "Nothing is waiting on the review shelf.",
    /** Approved. */
    shelfLine: "Records waiting for a reviewer. Pick one to review.",
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
    /** Approved. Followed by a date. */
    added: "Added",
    /** Approved. Followed by a date: a record a DJ is reviewing, on My reviews and as the record page's state chip, a disc and a digital album alike. */
    reviewingSince: "Reviewing since",
    /** Approved. */
    asked: "Asked",
    /** Approved. */
    checkOut: "Check out",
    /** Approved. */
    pass: "Pass",
    /** Approved. The Pass confirmation's question. */
    passTitle: (album: string, artist: string) => `Pass on ${album} by ${artist}?`,
    /** Approved. The Pass confirmation's body. */
    passConfirm: "It goes back on the review shelf, and the music directors see that you passed.",
    /** Approved. Shown once a pass has gone through. */
    passed: "Passed. The record is back on the review shelf.",
    /** Approved. */
    cancel: "Cancel",
    /** Approved. Lost races, shown once the lists have reloaded. */
    raceCheckout: "This record left the review shelf before your click went through. The lists have been reloaded.",
    /** Approved. Write a review and Pass share it on a request. */
    raceRequest: "This request is no longer open; it may have expired. The lists have been reloaded.",
    /** Approved. */
    raceRelease: "This record is no longer yours to review. The lists have been reloaded.",
    /** Approved. The button on a digital album on the review shelf. */
    take: "Take",
    /** Approved. The mark on a taken digital album that is overdue and has no submitted review. */
    notReviewedYet: "Not reviewed yet",
    /** Approved. The confirm dialog's question for a digital album. */
    returnQuestionDigital: "Put this record back on the review shelf? Another DJ can take it.",
    /** Approved. Shown on a taken digital album with no submitted review. */
    filesComing: "A music director will send you the files.",
  },
  /** The strip over the Reviews page's three tabs. */
  tabs: {
    /** The heading above the strip, drawn once for all three tabs. */
    heading: "Reviews",
    /** Approved. */
    reviewShelf: "Review shelf",
    /** Approved. */
    myReviews: "My reviews",
    /** Approved. */
    directors: "New music",
    /** What a screen reader hears after the New music tab's name when reviews are waiting. */
    waiting: (n: number) => `${n} ${n === 1 ? "review" : "reviews"} waiting`,
    /** Approved. What a screen reader hears after the My reviews tab's name when reviews are open. */
    open: (n: number) => `${n} open ${n === 1 ? "review" : "reviews"}`,
  },
  /** The sidebar's one entry for the Reviews page. */
  sidebar: {
    /** Approved. */
    title: "Reviews",
  },
  /** The music directors' lanes, on the Reviews page's second tab. */
  intake: {
    /** Approved. Shown once the lists have reloaded after Mark as returned lost a race. */
    raceReleased: "This record has already been returned or filed. The lists have been reloaded.",
    /** Approved. Shown once the lists have reloaded after a cancel lost its race. */
    raceCancel: "This request was already answered, or it expired. The lists have been reloaded.",
    /** Approved. Shown once the lists have reloaded after the Checked out lane's release lost its race. */
    raceCheckoutReleased: "This record has already been returned. The lists have been reloaded.",
    /** Approved. */
    cancelRequest: "Cancel request",
    /** Approved. The question of the Being reviewed lane's Return to the review shelf confirmation. */
    returnQuestion: (artist: string, album: string) => `Return ${artist}, ${album}, to the review shelf?`,
    /** Approved. That confirmation's body, naming the DJ who has the record. */
    returnBody: (name: string) => `${name} will no longer have it, and any DJ can choose to review it.`,
    /** Approved. Added to that confirmation's body for a disc whose holder can be named. */
    returnBringDisc: "Ask them to bring the disc to the music office.",
    /**
     * A proposal for the next copy round, not yet seen by the station: the return confirmation's body when the
     * holder's account was removed, so there is no name to give. A removed holder's disc leaves out the
     * bring-the-disc line on purpose, because there is nobody to ask.
     */
    returnBodyRemoved: "Any DJ can choose to review it.",
    /** Approved. The question of Mark as returned's confirmation on a Review waiting disc. */
    markReturnedQuestion: (artist: string, album: string) => `Mark ${artist}, ${album} as back in the music office?`,
    /** Approved. That confirmation's body, naming the DJ who has the record. */
    markReturnedBody: (name: string) => `${name} will no longer have it. Their review stays waiting for you to choose.`,
    /**
     * A proposal for the next copy round, not yet seen by the station: Mark as returned's body when the holder's
     * account was removed, so there is no name to give and no "their" to point back to.
     */
    markReturnedBodyRemoved: "The review stays waiting for you to choose.",
    /** Approved. Shown once the lists have reloaded after a request lost its race. */
    raceRequest: "This record has left the review shelf since the page loaded, so it can't be requested. The lists have been reloaded.",
    /** Approved. Shown when a request names an account that can no longer be asked to review. */
    requestRefused: "That DJ can't be asked to review: their account was removed, or it's no longer a DJ account. Pick someone else.",
    /** Approved. The item in a review shelf row's More menu, and the button on a record's page, that opens the search for a DJ to ask. */
    askADj: "Ask a DJ…",
    /** Approved. The music directors' menu button on each review shelf row, whose items are the ways to get a review. */
    moreButton: "More",
    /** Approved. The menu item that goes to the record's page to use a review the station already has. */
    moreCite: "Use a review we already have…",
    /** Approved. The menu item that goes to the record's page to digitize a review. */
    moreRecord: "Digitize a review…",
    /** Approved. Under Ask a DJ… in the menu. */
    moreAskDescription: "Held for them for 7 days.",
    /** Approved. Under Use a review we already have… in the menu. */
    moreCiteDescription: "From the copy in the library, or a form review.",
    /** Approved. Under Digitize a review… in the menu. */
    moreRecordDescription: "Type in a review that's on paper.",
    /** The search field's placeholder and name. */
    askSearch: "Search by name",
    /** The list's last line when more names match than it lists. */
    askOverflow: (n: number) => `${n} more match. Keep typing.`,
    /** Asked once a name is picked, before anything is sent. */
    askConfirm: (name: string, artist: string, album: string, onAir?: string | null) =>
      `Ask ${name}${onAir ? ` (on air as ${onAir})` : ""} to review ${artist}, ${album}? It's held for them for 7 days.`,
    /** A proposal for the next copy round: the caption over the people the search suggests before anyone types. */
    suggested: "Suggested",
    /** A proposal for the next copy round: the last line of the suggestions, which shows everyone the search finds. */
    searchAll: (n: number) => `Or search all ${n}`,
    /** A proposal for the next copy round: a result row's line when the on-air name differs from the name. */
    onAirAs: (handle: string) => `On air as ${handle}.`,
    /** A proposal for the next copy round: a result row's line for how many records the person has out. */
    recordsOut: (n: number) => (n === 0 ? "Nothing out." : n === 1 ? "1 record out." : `${n} records out.`),
    /** A proposal for the next copy round: a result row's line for a DJ who already passed on this record. */
    passedOnThis: "Passed on this record.",
    /** The search's line when no name matches what is typed. */
    askNoMatch: "No name matches that.",
    /** The search's line while the names are still loading. */
    askLoading: "Loading names…",
    /** The search's line when the names couldn't be loaded. */
    askLoadFailed: "Couldn't load the names. Please reload the page and try again.",
    /** The confirmation's button that sends the request. */
    ask: "Ask",
    /** The confirmation's button that returns to the list of names. */
    back: "Back",
    /** The toast shown once the request is sent; its action is Cancel request. */
    askDone: (name: string) => `Asked ${name}.`,
    /** Approved. */
    reviewersLoadFailed: "Couldn't load the DJs who can be asked to review. Please try again.",
    /** Approved. The New music tab's button, the dialog's title and its submit button. */
    logTitle: "Add a record",
    /** Approved. The New music tab's line, beside the Add a record button. */
    newMusicLine: "Every new record, from arrival to filing.",
    /** Approved. The Add a record dialog's line under its title, which describes the dialog. */
    addRecordLine: "It goes on the review shelf, where any DJ can choose to review it.",
    /** Approved. What the dialog says once a record is added. */
    addedLine: (artist: string, album: string) => `Added ${album} by ${artist}.`,
    /** Approved. Clears the form and keeps the dialog open. */
    addAnother: "Add another",
    /** Approved. Closes the dialog and shows the On the review shelf stage. */
    addDone: "Done",
    /** Approved. */
    artist: "Artist",
    /** Approved. */
    album: "Album",
    /** Approved. */
    label: "Label",
    arrival: "How did it arrive?",
    arrivedAsDisc: "A disc or a record",
    arrivedAsFiles: "As files",
    arrivedAsFilesHint: "Burned to CD-R once it's reviewed",
    /** Approved. */
    format: "Format",
    /** Approved. A digital record's format until it is filed. */
    digital: "Digital",
    discogsReleaseId: "Discogs link or release number (optional)",
    discogsRefused: "That isn't a Discogs release link or number.",
    /**
     * A proposal for the next copy round, not yet seen by the station: the Discogs field's line once a pasted link
     * or number has filled the form. It names all three fields even when some were already typed in, or Discogs
     * had no label, so the copy round should also decide whether it names only the fields it filled.
     */
    discogsFilled: "Filled in the artist, album and label from Discogs. Check them before you add the record.",
    /** A proposal for the next copy round, not yet seen by the station: the spinner's accessible name while the Discogs field's link is looked up. */
    discogsFilling: "Looking up the record on Discogs",
    /** Approved. */
    log: "Add a record",
    /** Approved. */
    waiting: "Review waiting",
    /** Approved. */
    onShelf: "On the review shelf",
    /** A proposal for the next copy round, not yet seen by the station: the accessible name of the chips that switch the New music tab's list. */
    stagesLabel: "Which records to show",
    /** Approved. The plain link, last in the row on every stage, to the record's page. */
    open: "Open",
    /** Approved. Reveals the filed records from before the last 30 days. */
    showOlder: "Show older",
    /** Approved. */
    requested: "Requested",
    /** Approved. Each is followed by a DJ name. */
    heldFor: "Held for",
    /** Approved. The location line of a record a DJ has; followed by the DJ's name. */
    with: "With",
    /** Approved. The location line when the DJ's account was removed. */
    withRemoved: "With a removed account",
    /** Approved. */
    reviewed: "Reviewed",
    /** Approved. */
    filed: "Filed",
    /** Approved. On each Filed row, followed by the short station date `filed_at` falls on. */
    filedOn: (date: string) => `Filed ${date}`,
    /** Approved. The first step of a record's progress track. */
    added: "Added",
    /** Approved. The first step of a requested record's progress track. */
    askedBy: (name: string) => `Asked by ${name}`,
    /** Approved. The fourth step of a record's progress track. */
    printed: "Printed",
    /** Approved. The progress track's accessible name. */
    progress: "Progress",
    /** Approved. A step the record has passed. */
    stepDone: "Done",
    /** Approved. The step the record is at. */
    stepCurrent: "Current",
    /** Approved. A step the record has not reached. */
    stepAhead: "Not yet",
    /** Approved. */
    returned: "Mark as returned",
    /** Approved. Followed by the holder's name. */
    stillWith: "Still with",
    /** Approved. */
    stillWithRemoved: "Still with a removed account",
    /** Approved. Who a waiting review is from, when its author is the DJ who has the record. */
    fromHolder: (author: string) => `From ${author}, who has this record.`,
    /** Approved. Someone else wrote it and a named DJ has the record. */
    fromWith: (author: string, holder: string) => `From ${author}. The record is with ${holder}.`,
    /** Approved. Someone else wrote it and a music director's request to a DJ is still open. */
    fromHeldFor: (author: string, holder: string) => `From ${author}. The record is being held for ${holder}.`,
    /** Approved. Someone else wrote it and the record is on the review shelf. */
    fromShelf: (author: string) => `From ${author}. The record is on the review shelf.`,
    /** Approved. The location line for a disc nobody has that is off the review shelf, and the record page's chip for such a disc in the pool. */
    backInOffice: "Back in the music office",
    /** Approved. The location line for a reviewed digital album nobody has. */
    readyToBurn: "Ready to burn",
    /** Approved. Someone else wrote it and the disc is back in the music office. */
    fromBackInOffice: (author: string) => `From ${author}. The record is back in the music office.`,
    /** Approved. Someone else wrote it and the digital album is ready to burn. */
    fromReadyToBurn: (author: string) => `From ${author}. The record is ready to burn.`,
    /** Approved. A digital album in the pool with a review waiting: nothing is held and nothing is ready to burn. */
    fromAuthor: (author: string) => `From ${author}.`,
    /** Approved. Someone else wrote it and the holder's account was removed. */
    fromRemoved: (author: string) => `From ${author}. The record is with a removed account.`,
    /** Approved. The further waiting reviews on a Review waiting row. */
    more: (n: number) => `+${n} more`,
    /** Approved. */
    empty: "Nothing here.",
    /** Approved. The notice band's accessible name, over the recent passes. */
    recentPasses: "Recent passes",
    /** Approved. One line of the notice band: "Pat passed on Juana Molina — DOGA". */
    passedLine: (dj: string, artist: string, album: string) => `${dj} passed on ${artist} — ${album}`,
    /** Approved. A Recent passes line followed by the date of the pass: "Pat passed on Juana Molina — DOGA · Oct 8". */
    passedLineDated: (line: string, date: string) => `${line} · ${date}`,
    /** Approved. The lane of records a DJ is reviewing, for a disc and a digital album alike. */
    beingReviewed: "Being reviewed",
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
    /** Approved. One of the two choices under the "File it" heading: file the record as new. */
    fileNew: "New to the library",
    /** Approved. One of the two choices under the "File it" heading: search for a record the library already has. */
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
    /** Approved. The button under Other reviews while nothing is on the cover. */
    useThisReview: "Use this review",
    /** Approved. The button under Other reviews while a review is on the cover; also the confirmation's confirm button. */
    useThisReviewInstead: "Use this review instead",
    /** Approved. The replace confirmation's question. */
    replaceCover: "Replace the review on the cover with this one? If a slip is already taped to the record, print the slip again to replace it.",
    /** Approved. Shown while the record is checked out to someone other than the review on the cover's author. */
    stillOutWith: (holder: string) => `The record is still out with ${holder}.`,
    /** Approved. Shown, with no server words, once the page has reloaded after the chosen review was refused. */
    reviewGone: "That review can't be used for this record any more. It may have been deleted since the page opened. The page has been refreshed.",
    /** Approved. The button that deletes one review, on the review on the cover and under Other reviews. */
    deleteReview: "Delete review",
    /** Approved. The spoken name of that button. */
    deleteReviewBy: (author: string) => `Delete review by ${author}`,
    /** Approved. An ordinary review's confirmation. */
    deleteReviewConfirm: (author: string) => `Delete ${author}'s review? Its history goes with it. This cannot be undone.`,
    /** Approved. The cover review's confirmation while a named DJ holds the record. */
    deleteCoverHeld: (holder: string) =>
      `This is the review on the cover. Deleting it sends the record back to ${holder}. Its history goes with it. This cannot be undone.`,
    /** Approved. The cover review's confirmation while nobody holds the record. */
    deleteCoverShelf:
      "This is the review on the cover. Deleting it sends the record back to the review shelf. Its history goes with it. This cannot be undone.",
    /** Approved. The cover review's confirmation while the holder's account was removed. */
    deleteCoverRemoved: "This is the review on the cover. Deleting it puts the record back with its holder, whose account was removed.",
    /** Approved. Shown beside the disabled Delete review of a filed record's cover review, and when the server refuses anyway. */
    deleteCoverFiled: "This is the record's review and the record is already filed. Choose another review for the cover first, then delete this one.",
    /** Approved. The filing section's heading. */
    fileIt: "File it",
    /** Approved. The line beside the record's Delete, at the foot of the page. */
    deleteRecordHint: "Delete this record only if it was logged by mistake. Its reviews and drafts go with it.",
    /** Approved. The heading of the cited release's reviews, on a record that cites a release. */
    citedHeading: (artist: string, album: string) => `Reviews of ${artist} — ${album}`,
    /** Approved. Under that heading while the cited release has a typed review. */
    citedChoose: "These are the library's reviews of this record. Choose the one to print for this copy.",
    /** Approved. Under that heading when the cited release has no typed review in the DJ site. */
    citedNone: "The library has no typed review of this record.",
    /** Approved. Opens the Digitize a review form empty, beside the line above. */
    typeInReview: "Type in the review from its cover",
    /** Approved. Opens the Digitize a review form with Handwritten chosen, for a review that exists only on paper. */
    copyByPen: "Copy it by pen",
    /** Approved. On each form review of the cited release: opens the form filled in from it, headed Copy from Google Forms. */
    copyOntoRecord: "Copy this review onto the record",
    /** The heading of the block at the top of a record's page while no review is chosen, from the station's mockup. */
    originTitle: "Where its review is coming from",
    /** Between the block's where-now line and the other ways to get a review, from the station's mockup. */
    originOr: "Or:",
    /** Approved. Beside Digitize a review on a record's page. */
    recordExplanation: "For a review written on the sleeve, or one a DJ gave you to type in.",
    /** Approved. The accessible name of the search box that cites a release; the filing arm's box keeps `searchLibrary`. */
    searchCite: "Search the library for the record this one cites",
    /** Approved. Asked before removing a citation whose review is on this record's cover. */
    removeAsksCover: "Removing the citation also takes its review off this record's cover.",
    /** Asked before citing a review on a record a DJ is asked to review: the citation withdraws the request. */
    citeAsked: (name: string) => `${name} is asked to review this. Using a review we already have cancels the request.`,
    /** Asked before citing a review on a record a DJ has: the record stays with them. */
    citeTaken: (name: string) => `${name} has this record and may be writing a review. Use the existing review anyway?`,
    /** Approved. Opens a library search for the release whose review this record uses; also that search's heading once open. */
    citeRelease: "Cite a release in the library",
    /** Approved. The cited list's heading when the cited release's name can't be loaded. */
    citedFallbackHeading: "Reviews of the record this one cites",
    /** Approved. On a record that cites something and isn't filed yet. */
    removeCitation: "Remove the citation",
    /** Approved. Confirms the question above; the other button is "Cancel". */
    removeIt: "Remove it",
    /** Approved. The server refuses a release: no submitted review, and added after the cutover date. */
    releaseRefused: "That release can't be cited: it has no submitted review and was added to the library after the cutover date.",
    /** Approved. Opens a search of the form archive by artist; also that search's heading once open. */
    citeForm: "Cite a form review",
    /** Approved. The form search's field. */
    formArtist: "Artist",
    /** Approved. Under that field. */
    formArtistNote: "Only exact artist names match. A leading \"The\" and capital letters don't matter.",
    /** Approved. */
    formSearchFailed: "Couldn't search the form reviews. Please try again.",
    /** Approved. */
    formNone: "No form reviews under this exact artist name.",
    /** Approved. Above the list of form reviews. */
    formNotPrintable: "A form review can't be printed from here until it is copied onto the record.",
    /** Approved. The page's only line after a copied review's save, when the citation is refused for a form review dated after the cutover. */
    formAfterCutover: "Copied. The record can't cite this form review: it was sent in after the cutover date.",
    /** Approved. The same refusal for a form review with no date. */
    formNoDate: "Copied. The record can't cite this form review: it has no date.",
    /** Approved. The citation write failed for any other reason. */
    formNotNoted: "Copied. Couldn't note which form review it came from.",
  },
  /** The music directors' form that records a review of one record, on `/dashboard/admin/intake/{id}`. */
  record: {
    /** Approved. The form's heading when it opens empty or by pen, and the button on a record's page that opens it. */
    title: "Digitize a review",
    /** Approved. The form's heading when it opens filled in from a form review. */
    copyTitle: "Copy from Google Forms",
    /** Approved. */
    author: "Author",
    /** Approved. Shown when the author is blank. */
    authorBlank: "Say who wrote the review.",
    /** Approved. Shown for a typed review with no text. */
    textBlank: "Write the review before you save it.",
    /** Approved. */
    account: "Link to an account (optional)",
    /** Approved. */
    notLinked: "Not linked",
    /** Approved. Shown under the picker if the accounts can't be loaded. */
    accountsFailed: "Couldn't load the accounts. Please try again.",
    /** Approved. */
    medium: "Typed or handwritten?",
    /** Approved. */
    typed: "Typed",
    /** Approved. */
    handwritten: "Handwritten",
    /** Approved. Shown once Handwritten is chosen. */
    handwrittenNote: "This review is handwritten, so it is already on the sleeve. Nothing will be printed.",
    /** Approved. */
    noConsent: "Nothing is ticked for publishing: the author hasn't been asked where this review may be published.",
    /** Approved. Under the form, for a record with no review on the cover. */
    coverNone: "This will be the review on the cover.",
    /** Approved. Under the form, for a record that already has one. */
    coverReplaces: "This replaces the review now on the cover. If a slip is already taped to the record, print the slip again to replace it.",
    /** Approved. Under the account list, only when the chosen account isn't the music director's own. */
    emailed: (name: string) =>
      `${name} will be emailed that their review is now in the DJ site. They can edit it and answer the publishing question themselves.`,
    /** Approved. Any other failure when saving. */
    couldNotSave: "Couldn't save the review. Please try again.",
    /** Approved. Shown after saving a review digitized from paper. */
    digitized: "Digitized.",
    /** Approved. Shown after saving a review copied from a form review. */
    copied: "Copied.",
    /** Approved. Shown when a create that linked an account is refused. */
    accountGone: "That account no longer exists. Pick another, or leave the review unlinked.",
    /** Approved. The checkbox that puts the recorded review on the cover. */
    useAsCover: "Use this as the record's review",
    /** Approved. Under the checkbox when it is unticked. */
    otherReview: "Saved as one of the record's other reviews. You can choose it for the cover later.",
    /** Approved. When the box is unticked and the review was created but couldn't be submitted. */
    draftNotSubmitted: "The review was saved as a draft but couldn't be submitted. You'll find it under My reviews.",
    /** Approved. Above the form when it opens filled in from one review in the archive. */
    copiedFromForm: "Copied from Google Forms. Check it, then save.",
    /** Approved. Under the author field when the reviewer's name was copied. */
    copiedAuthor: "Copied as the reviewer wrote it, so it may include a date.",
    /** Approved. Replaces the line above when the archived review has no reviewer name. */
    copiedNoName: "Copied from Google Forms. Check it, add the reviewer's name, then save.",
    /** Approved. When the form opens with Handwritten already chosen. */
    byHand: "This review exists only on paper. Copy this record's slip by hand, then digitize it here.",
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
  /** The review editor's back link. The page draws a "←" before it, hidden from screen readers, so the arrow is not part of the link's name. */
  editorBack: {
    /** Approved. */
    myReviews: "My reviews",
    /** Approved. Also where a back link goes when the editor was opened from nowhere in particular. */
    shelf: "Review shelf",
    /** A proposal, worded after the approved `intakeSlip.backToRecord`. */
    record: "Back to the record's page",
  },
  myReviews: {
    /** The accessible name of the chips that switch the My reviews tab's list. */
    stagesLabel: "Which of my reviews to show",
    stages: {
      /** Approved. Requests for me and Records I'm reviewing, as one list. */
      open: "Open reviews",
      /** Approved. */
      submitted: "Submitted",
      /** Approved. The DJ's reviews a music director chose for the cover. */
      published: "Published",
    },
    /** Approved. */
    openEmpty: "Nothing is waiting on you right now.",
    /** Approved. Reveals the next 20 of a long Submitted or Published list. */
    showOlder: "Show older reviews",
    /** Approved. */
    draft: "Draft",
    /** Approved. */
    submitted: "Submitted",
    /** Approved. */
    open: "Open",
    /** Approved. */
    libraryRelease: "A library release",
    /** Approved. The tag on a review of a library release. */
    fromTheLibrary: "from the library",
    /** Approved. Followed by the review's last-modified date. */
    lastSaved: "Last saved",
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
    /** Approved. Shown for a handwritten review without text: beside its author in the list of other reviews, and as the Review row's value when that review is on the cover. */
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
    /** Approved. Expands the cover review's full slip. */
    showSlip: "Show the whole slip",
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
  /** The notice above the editor when it opens on a review that was left with unsaved text. */
  restore: {
    /** Approved. */
    notice: "You left this review with unsaved changes.",
    /** Approved. Puts the unsaved text back into the form. */
    restore: "Restore my changes",
    /** Approved. Throws the unsaved text away and keeps the review as last saved. */
    discard: "Discard them",
  },
  /** The dialog that asks before a form with unsaved changes is left. */
  leave: {
    /** Approved. */
    title: "Leave without saving?",
    /** Approved. */
    body: "Your changes since the last save will be lost.",
    /** Approved. */
    leave: "Leave",
    /** Approved. Takes the focus; closes the dialog. */
    keepEditing: "Keep editing",
    /** Approved. The Digitize a review form's leave-dialog body. */
    recordBody: "The review you've typed here will be lost.",
  },
} as const;
