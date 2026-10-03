# Reviews surface mirrors the iOS model — many per release, scoped to an intake item or a library release, locked at print, consent-gated per surface

Canonical source: [`wxyc-dj-ios/docs/cross-repo-adrs.md` ADR 0005](https://github.com/WXYC/wxyc-dj-ios/blob/main/docs/cross-repo-adrs.md#adr-0005--reviews-are-many-per-release-scoped-to-an-intake-item-or-a-library-release-locked-at-print-consent-gated-per-surface). This file mirrors that decision for the dj-site surface and does not restate it in full; where the two disagree, the canonical ADR wins.

A review is about an intake item (a physical copy the station holds, logged by a music director) or an existing library release, never a record the station does not hold. A release can have many reviews. A review carries the printed slip's free-text content (buzzwords, an artist paragraph, the review itself, recommended tracks, and FCC notes) plus per-surface publishing consent. There is no rating, no headline, no per-track polarity, and no curated tag vocabulary. A review carries no routing: the music director alone decides rotation versus shelf when filing.

The intake pile, checkout, request, and pass flow is the same on every surface. A music director logs items and requests named DJs; a DJ checks an item out to write its review; a checkout never lapses but is flagged overdue after 14 days. A review locks at print, not at submission: until an intake item's slip is printed, its author may edit a submitted review; after that, only music directors edit and reprint. A review of a release already in the library is never printed and stays editable by its author.

After the cutover date, every release entering the library or rotation needs a submitted review or a citation. Releases catalogued before the cutover are deemed reviewed. The form and the app overlap through fall 2026; the cutover and the form's close are one day at the start of the spring 2027 semester.

Consent is collected per surface: one checkbox each for the website, the WXYC apps, and Instagram, plus one credit choice (DJ name, real name, or no name). FCC notes are never published on any surface. v1 collects consent and publishes nothing new with it. Author names may be shown anywhere inside the station, including dj-site.

The form archive (Backend-Service ADR 0011) stays a separate table; it is cited by intake items, never merged into reviews.

## What dj-site ships

These are the dj-site specifics for this mirror. The DJ and music director screens are on the web surface; the DJ mobile apps are not in v1.

- The DJ pile and review editor at `/dashboard/reviews` and `/dashboard/reviews/{id}`. These are modern-experience screens; the classic experience shows `ExperienceGap`.
- The MD intake admin at `/dashboard/admin/intake` and `/dashboard/admin/intake/{id}`, covering logging and requesting items, recording reviews on behalf of others and handwritten ones, filing with a call number, and the slip print view. These are modern-experience screens.
- The reviews panel on the shared album page `/dashboard/album/{id}`, linking a catalog release to its submitted reviews.
- The librarian's finalize step on the classic Awaiting Cataloging list. This is classic-first because the librarian works in the classic experience.

## Build-time values

- `NEXT_PUBLIC_REVIEWS_ENABLED` gates the review screens for the period the form and the app overlap. It is inlined at build time, so changing it requires a rebuild.
- `NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE` sets the cutover date for the hard gate. It is compared at run time, so changing the cutover does not require a rebuild.

## Backend contract

dj-site consumes the Backend-Service `/intake` and `/reviews` endpoints and the `reviews` permission key described in the canonical ADR. Library and rotation inserts enforce the cutover gate on the server; dj-site surfaces the gate's refusals but does not decide them.
