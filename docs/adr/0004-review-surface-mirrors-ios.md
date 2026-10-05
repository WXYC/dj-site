# Reviews are many per release, scoped to an intake item or a library release, chosen for the cover by a music director, consent-gated per surface

Canonical source: [`wxyc-dj-ios/docs/cross-repo-adrs.md` ADR 0005](https://github.com/WXYC/wxyc-dj-ios/blob/main/docs/cross-repo-adrs.md#adr-0005--reviews-are-many-per-release-one-accepted-by-a-music-director-as-the-records-review-consent-gated-per-surface). This file mirrors that decision for the dj-site surface and does not restate it in full; where the two disagree, the canonical ADR wins. Two points follow the plan of record (epic WXYC/Backend-Service#2791) instead, because it is newer than the canonical text: the email to the music directors when an FCC note is reported, and decision 35 (a record keeps its own copy of a cited review).

Status: Accepted, 2026-10-02, with the canonical ADR; amended 2026-10-04 to the station's decisions of that date. The earlier text survives only in this file's git history. The 2026-10-02 version superseded the one-per-album, author-owned model with an MD-curated claim queue that this file recorded before it.

A review is about an intake item (a physical copy the station holds, logged by a music director) or an existing library release, never a record the station does not hold. A release can have many reviews. A review carries the printed slip's free-text content (buzzwords, an artist paragraph, the review itself, recommended tracks, and FCC notes) plus per-surface publishing consent. There is no rating, no headline, no per-track polarity, and no curated tag vocabulary. A review carries no routing: the music director alone decides rotation versus shelf when filing.

## Many reviews, one chosen

A record becomes reviewed only when a music director chooses one of its submitted reviews for the cover. Submitting a review does not move the record; a review of a pile item notifies the music directors by email, and a review of a library release notifies nobody. The music director can change the choice at any time, before or after filing, which is how a review is replaced. There is no reject or send-back step: an unwanted review is simply not chosen, or is deleted.

A review a music director records (on someone's behalf, or handwritten) becomes the record's review by default, with an opt-out, and can be recorded at any stage of the record's life.

## No print lock

An author edits their own review at any time, printed or not. Music directors may edit the text of any review, and the author is told by email. Every version of a submitted review is kept and readable by anyone who can read the review. The page shows the current text and says which version is on the cover. Drafts are not versioned, and deleting a review deletes its history.

## Printing

The slip prints the chosen review and the record's confirmed FCC notes, and can be printed as soon as a review is chosen; filing first is not required. A handwritten review stays on the sleeve, and nothing is printed for it. A music director can also print a typed review of any library release, including one with no pile record.

A record that cites a release takes its cover review from that release. If the cited release is later deleted from the catalog, the record keeps its own complete copy of that review (decision 35 in the epic, WXYC/Backend-Service#2875; the canonical ADR does not say this yet).

## Consent belongs to the author

Consent is collected per surface: one checkbox each for the website, the WXYC apps, and Instagram, plus one credit choice: DJ name (offered only if the account has one), real name, or no name. Only a review's author, through their own account, sets these choices. Nobody else can, a music director included. A review recorded on someone's behalf starts with nothing ticked. When it is linked to a DJ's account, that DJ is its author and alone sets its consent. A review with no linked account has nobody who can set its consent. The editor shows the consent controls only to the author. FCC notes are never published on any surface. v1 collects consent and publishes nothing new with it. Author names may be shown anywhere inside the station, including dj-site.

## Deleting

An author cannot delete a review that is in use (chosen for a record's cover, or the latest one printed for a copy), but can still edit it. A music director can delete any review except the chosen review of a filed record that was not filed on a citation, until another review is chosen for it. Deleting the chosen review of a record not yet filed sends the record back to its holder, or to the pile.

## FCC notes on the record

FCC notes can sit on the record, separate from a review's own FCC line. Any DJ can report one against a library release or a pile item. Everyone sees it at once, marked as not yet confirmed, and reporting one emails the music directors. A music director confirms or removes it, and the DJ who reported it may remove it while it is unconfirmed. Removing a note deletes it. A review's own FCC line always prints; of the record's notes, only confirmed ones print.

## Notices

Notices to DJs are email in v1; there is no in-app inbox.

## Pile and intake flow

The intake pile, checkout, request, and pass flow is the same on every surface. A music director logs items and requests named DJs; a DJ checks an item out to write its review; a checkout never lapses but is flagged overdue after 14 days.

After the cutover date, every release entering the library or rotation needs a review chosen for the cover, or a citation, apart from the two legacy paths described under Backend contract. Releases catalogued before the cutover are deemed reviewed. The form and the app overlap through fall 2026; the cutover and the form's close are one day at the start of the spring 2027 semester.

The form archive (Backend-Service ADR 0011) stays a separate table; it is cited by intake items, never merged into reviews.

## What dj-site ships

These are the dj-site specifics for this mirror. The DJ and music director screens are on the web surface; the DJ mobile apps are not in v1.

- The DJ pile and review editor at `/dashboard/reviews` and `/dashboard/reviews/{id}`. These are modern-experience screens; the classic experience shows `ExperienceGap`. The editor shows the consent controls only to the review's author.
- The review history page at `/dashboard/reviews/{id}/history`, listing every version of a submitted review and marking the one on the cover. This is a modern-experience screen; the classic experience shows `ExperienceGap`.
- The MD intake admin at `/dashboard/admin/intake` and `/dashboard/admin/intake/{id}`, covering logging and requesting items, recording reviews on behalf of others and handwritten ones, choosing the review for the cover, filing with a call number, and the slip print view at `/dashboard/admin/intake/{id}/slip`. These are modern-experience screens.
- The library slip at `/dashboard/admin/library/{albumId}/slip/{reviewId}`: the same slip print view, for a typed review of a release already in the library, including one with no pile record. This is a modern-experience screen.
- The reviews panel on the shared album page `/dashboard/album/{id}`: "the review on the cover" first, then the other reviews, newest first (a handwritten one shows as "on the sleeve"); the form archive's entries as cited prior takes; and "Review this release", where a DJ starts a review of a release already in the library. The screens never say "intake review" or "release review".
- The FCC notes panel on the album page, where any DJ reports a note and music directors confirm or remove them, and the same report action on a pile item.
- The librarian's finalize step on the classic Awaiting Cataloging list. This is classic-first because the librarian works in the classic experience.

## Build-time values

- `NEXT_PUBLIC_REVIEWS_ENABLED` turns the review screens on. Turning it on is what opens the overlap with the form, and it stays on after cutover, when intake filing is the only way a new release enters the library, apart from the legacy import described under Backend contract. It is inlined at build time, so changing it requires a rebuild and deploy.
- `NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE` (`YYYY-MM-DD`, station time; unset means off) drives the cutover changes in dj-site's UI: from that date each of the five create screens (the classic typed-text rotation add, the three catalog add-release screens, and the standalone filing bench) has its create action replaced by a pointer to the intake pile; the screens themselves stay. Like every `NEXT_PUBLIC_*` value it is inlined at build time, so setting or changing it needs a dj-site production deploy; only the date's arrival needs no deploy, because dj-site compares it with the current date at run time. It does not configure the gate itself. The hard gate is Backend-Service's `REVIEW_GATE_CUTOVER_DATE`, and the two must be set to the same date.

## Backend contract

dj-site consumes the Backend-Service `/intake` and `/reviews` endpoints and the `reviews` permission key described in the canonical ADR. Library and rotation inserts enforce the cutover gate on the server; dj-site surfaces the gate's refusals but does not decide them.

Two paths survive the cutover (decision 17 in the decisions table of the plan of record, epic WXYC/Backend-Service#2791): a typed-text rotation record from before the cutover may still change bins after it, and keeps its right to be imported into the library by the librarian. Once the contract change in WXYC/wxyc-shared#539 and the slices that consume it land, dj-site's classic import of a legacy typed-text row sends `POST /library` with `from_rotation_id`, and modern's cross-bin move of an unlinked row sends `moved_from_rotation_id`. Until then the import is two requests (add the release, then link the rotation row) and the move adds the new row and kills the old one from the client. Both paths keep working after the cutover date; the pointers above replace only the create paths.
