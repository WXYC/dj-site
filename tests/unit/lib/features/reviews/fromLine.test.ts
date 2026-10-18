import { describe, it, expect } from "vitest";
import type { IntakeItem, Review } from "@wxyc/shared";
import { fromLine } from "@/src/components/experiences/modern/reviews/ReviewFrom";
import { heldBy, intakeItem, removedHolder, requestedFor, returnedByMusicDirector, review } from "@/tests/fakes/reviews";

const HELD_BY_JESS = { effective_state: "checked_out" as const, ...heldBy("dj-jess", "Jessica Pratt") };
const HELD_BY_SAM = { effective_state: "checked_out" as const, ...heldBy("dj-sam", "DJ Sam") };
const REMOVED_HOLDER = { effective_state: "checked_out" as const, ...removedHolder };
const REQUESTED_BY_PAT = { effective_state: "requested" as const, ...requestedFor("dj-pat", "DJ Pat") };
// A live request that names who it is held for but carries no account id.
const REQUESTED_NO_ACCOUNT = { effective_state: "requested" as const, ...requestedFor(null, "DJ Pat") };

const FROM_JESS: Partial<Review> = { author: "Jessica Pratt", author_user_id: "dj-jess" };

describe("fromLine", () => {
  it.each<[string, Partial<IntakeItem>, Partial<Review>, string | null]>([
    ["the author is the DJ who has the record", HELD_BY_JESS, FROM_JESS, "From Jessica Pratt, who has this record."],
    ["someone else wrote it and a DJ has the record", HELD_BY_SAM, FROM_JESS, "From Jessica Pratt. The record is with DJ Sam."],
    ["someone else wrote it and a request is open", REQUESTED_BY_PAT, FROM_JESS, "From Jessica Pratt. The record is being held for DJ Pat."],
    ["someone else wrote it and the holder's account was removed", REMOVED_HOLDER, FROM_JESS, "From Jessica Pratt. The record is checked out; holder removed."],
    // A record with a waiting review is off the review shelf, so the shelf line shows only where a stale list still reads none submitted.
    ["someone else wrote it and a stale list reads the record as on the review shelf", { effective_state: "pool" }, FROM_JESS, "From Jessica Pratt. The record is on the review shelf."],
    ["the author is the DJ the record is held for", REQUESTED_BY_PAT, { author: "DJ Pat", author_user_id: "dj-pat" }, "From DJ Pat, who has this record."],
    ["the review has no linked account, it never matches the DJ who has the record", HELD_BY_JESS, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is with Jessica Pratt."],
    ["the review has no linked account and a request names no account, it still matches nobody", REQUESTED_NO_ACCOUNT, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is being held for DJ Pat."],
    ["the review has no linked account and the holder's account was removed", REMOVED_HOLDER, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is checked out; holder removed."],
    ["the review has no linked account and a stale list reads the record as on the review shelf", { effective_state: "pool" }, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is on the review shelf."],
    ["a disc is back in the music office with a review waiting", { effective_state: "pool", submitted_review_count: 1 }, FROM_JESS, "From Jessica Pratt. The record is back in the music office."],
    ["a music director returned a checked out disc with a review waiting", returnedByMusicDirector, FROM_JESS, "From Jessica Pratt. The record is back in the music office."],
    ["a digital album is in the pool with a review waiting, it names only the author", { effective_state: "pool", digital: true, submitted_review_count: 1 }, FROM_JESS, "From Jessica Pratt."],
    ["a reviewed disc was returned", { effective_state: "reviewed" }, FROM_JESS, "From Jessica Pratt. The record is back in the music office."],
    ["a reviewed digital album is nobody's", { effective_state: "reviewed", digital: true }, FROM_JESS, "From Jessica Pratt. The record is ready to burn."],
    ["nobody has a filed record, it says nothing", { effective_state: "filed" }, FROM_JESS, null],
    ["nobody has a finalized record, it says nothing", { effective_state: "finalized" }, FROM_JESS, null],
    ["the author is unknown", HELD_BY_SAM, { author: null }, null],
  ])("when %s", (_label, itemOverrides, reviewOverrides, expected) => {
    expect(fromLine(review({ status: "submitted", ...reviewOverrides }), intakeItem(itemOverrides))).toBe(expected);
  });
});
