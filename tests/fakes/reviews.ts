import type { FccNote, IntakeItem, IntakeSlip, Review, ReviewRevision } from "@wxyc/shared";
import { fakeAlbumReviewEndpoints, type FakeAlbumReviewOptions } from "./reviews/albumReview";
import { fakeFccNoteEndpoints, type FakeFccNoteOptions } from "./reviews/fccNote";
import { fakeIntakeEndpoints, type FakeIntakeOptions } from "./reviews/intake";
import { fakeLibraryLookupEndpoints, type FakeLibraryOptions } from "./reviews/library";
import { fakeReviewEndpoints, type FakeReviewOptions } from "./reviews/review";

/**
 * Stand-in for every GET the reviews screen and the review editor make, so a
 * spec that renders either one cannot fall through to the network (MSW
 * bypasses unhandled requests, and a missing read shows up as the component's
 * load-failure line). `fakeReviewsEndpoints` is only a composite: it hands its
 * options to one builder per route family in `./reviews/`, and each builder's
 * doc comment lists the routes it answers.
 *
 * Where a fake goes: in the builder for its route family, the first path
 * segment of the route's `url` (the same rule as the endpoints in
 * `lib/features/reviews/api.ts`). A new filter on an existing route is handled
 * inside that route's handler in the builder (for intake, `state=` filters the
 * union of every state), with a case in that builder's own spec. A new route
 * family gets its own builder and one line in the composite. A fake never goes
 * in the composite itself.
 *
 * Lists default to empty. A spec that holds, counts or fails a read layers its
 * own `server.use(...)` over these defaults. When the screen or the editor
 * gains a read, add its default to the builder so no other spec has to learn
 * about it.
 */
export function fakeReviewsEndpoints(
  options: FakeIntakeOptions & FakeReviewOptions & FakeAlbumReviewOptions & FakeLibraryOptions & FakeFccNoteOptions = {},
) {
  fakeIntakeEndpoints(options);
  fakeReviewEndpoints(options);
  fakeAlbumReviewEndpoints(options);
  fakeLibraryLookupEndpoints(options);
  fakeFccNoteEndpoints(options);
}

/** A reported FCC note on the record `intakeItem()` describes. */
export const fccNote = (overrides: Partial<FccNote> = {}): FccNote =>
  ({
    id: 1,
    album_id: null,
    intake_item_id: 1,
    track: "A2",
    note: "A swear word in the second verse.",
    status: "reported",
    reported_by: "DJ Me",
    reported_by_user_id: "dj-me",
    reported_at: "2026-10-01T12:00:00Z",
    confirmed_by: null,
    confirmed_at: null,
    artist_name: "Stereolab",
    album_title: "Aluminum Tunes",
    ...overrides,
  }) as FccNote;

/** An intake record on the review shelf, with WXYC-representative data. */
export const intakeItem = (overrides: Partial<IntakeItem> = {}): IntakeItem =>
  ({
    id: 1,
    artist_name: "Stereolab",
    album_title: "Aluminum Tunes",
    record_label: "Duophonic",
    format_id: 1,
    state: "pool",
    effective_state: "pool",
    overdue: false,
    logged_at: "2026-09-01T12:00:00Z",
    requested_dj_id: null,
    requested_at: null,
    checked_out_by: null,
    checked_out_at: null,
    ...overrides,
  }) as IntakeItem;

/** The slip a print answers with, for Juana Molina's DOGA: the record the slip specs override `intakeItem()` to, not the builder's default Stereolab record. */
export const intakeSlip = (overrides: Partial<IntakeSlip> = {}): IntakeSlip => ({
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  buzzwords: "spectral, loops",
  artist_blurb: "Argentine songwriter.",
  review: "Hushed and strange.",
  author: "DJ Me",
  submitted_at: "2026-10-07T16:00:00Z",
  recommended_tracks: "A1, B4",
  fcc: "A2 has a slip of the tongue",
  revision_id: 3,
  fcc_notes: [{ track: "B1", note: "Mild language" }],
  ...overrides,
});

/** A draft review of the record `intakeItem()` describes. */
export const review = (overrides: Partial<Review> = {}): Review =>
  ({
    id: 40,
    intake_item_id: 2,
    album_id: null,
    author: "DJ Me",
    add_date: "2026-10-07",
    status: "draft",
    medium: "typed",
    buzzwords: null,
    artist_blurb: null,
    review: "Warm.",
    recommended_tracks: null,
    fcc: null,
    ...overrides,
  }) as Review;

/** One saved version of a submitted review. */
export const reviewRevision = (overrides: Partial<ReviewRevision> = {}): ReviewRevision =>
  ({
    id: 100,
    review_id: 40,
    revision: 1,
    edited_by: "DJ Me",
    edited_by_user_id: "dj-me",
    edited_at: "2026-10-07T16:00:00Z",
    review: "Warm.",
    artist_blurb: null,
    buzzwords: null,
    recommended_tracks: null,
    fcc: null,
    ...overrides,
  }) as ReviewRevision;
