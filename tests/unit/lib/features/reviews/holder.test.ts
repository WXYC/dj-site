import { describe, it, expect } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { itemHolder, onReviewShelf, unheldPlace, type Holder, type UnheldPlace } from "@/lib/features/reviews/holder";
import { heldBy, intakeItem, removedHolder, requestedFor, returned, returnedByMusicDirector } from "@/tests/fakes/reviews";

const NONE: Holder = { kind: "none" };
const REMOVED: Holder = { kind: "removed" };

describe("itemHolder", () => {
  it.each<[string, Partial<IntakeItem>, Holder]>([
    ["a record on the review shelf", { effective_state: "pool" }, NONE],
    ["a stale request read as the shelf, even with the old request fields set", { effective_state: "pool", ...requestedFor("dj-pat", "DJ Pat") }, NONE],
    ["a live request names the requested DJ", { effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") }, { kind: "requested", id: "dj-pat", name: "DJ Pat", askedBy: null }],
    ["a live request with no account id still names who it is held for", { effective_state: "requested", ...requestedFor(null, "DJ Pat") }, { kind: "requested", id: null, name: "DJ Pat", askedBy: null }],
    ["a live request ignores a holder left on the row", { effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat"), ...heldBy("dj-sam", "DJ Sam") }, { kind: "requested", id: "dj-pat", name: "DJ Pat", askedBy: null }],
    ["a checked out record names who checked it out", { effective_state: "checked_out", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a checked out record whose holder's account was removed", { effective_state: "checked_out", ...removedHolder }, REMOVED],
    ["a reviewed record still with its holder", { effective_state: "reviewed", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a reviewed record whose holder's account was removed", { effective_state: "reviewed", ...removedHolder }, REMOVED],
    ["a reviewed record that was returned", { effective_state: "reviewed" }, NONE],
    ["a filed record still naming its holder", { effective_state: "filed", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a finalized record still naming its holder", { effective_state: "finalized", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a filed record with a removed holder reads as nobody", { effective_state: "filed", ...removedHolder }, NONE],
    ["a filed record with no holder", { effective_state: "filed" }, NONE],
  ])("%s", (_label, overrides, expected) => {
    expect(itemHolder(intakeItem(overrides))).toEqual(expected);
  });
});

describe("itemHolder askedBy", () => {
  it.each<[string, Partial<IntakeItem>, string | null]>([
    ["the asker's name", { requested_by_name: "Mike" }, "Mike"],
    ["null for a request made before the asker was recorded", { requested_by_name: null }, null],
    ["null for an empty name", { requested_by_name: "" }, null],
    ["null for a blank name", { requested_by_name: "  " }, null],
    ["null when the field is absent", {}, null],
  ])("a live request reads %s", (_label, overrides, expected) => {
    const holder = itemHolder(intakeItem({ effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat"), ...overrides }));
    expect(holder).toEqual({ kind: "requested", id: "dj-pat", name: "DJ Pat", askedBy: expected });
  });
});

describe("onReviewShelf", () => {
  // The contract's submitted_review_count counts only reviews whose status is submitted: a draft never counts, and a deleted
  // review stops counting. So the draft-only and since-deleted rows read the same input as no reviews; the rule cannot tell them apart.
  it.each<[string, Partial<IntakeItem>, boolean]>([
    ["a pool record with no reviews", { effective_state: "pool", submitted_review_count: 0 }, true],
    ["a pool record with a draft only", { effective_state: "pool", submitted_review_count: 0 }, true],
    ["a pool record with a submitted review", { effective_state: "pool", submitted_review_count: 1 }, false],
    ["a pool record whose submitted review was deleted", { effective_state: "pool", submitted_review_count: 0 }, true],
    ["a checked out record with a submitted review that a music director returned", returnedByMusicDirector, false],
    ["a requested record", { effective_state: "requested", submitted_review_count: 0 }, false],
    ["a checked out record", { effective_state: "checked_out", submitted_review_count: 0 }, false],
    ["a reviewed record", { effective_state: "reviewed", submitted_review_count: 0 }, false],
  ])("%s", (_label, overrides, expected) => {
    expect(onReviewShelf(intakeItem(overrides))).toBe(expected);
  });
});

describe("unheldPlace", () => {
  it.each<[string, Partial<IntakeItem>, UnheldPlace]>([
    ["a pool record with no review waiting", { effective_state: "pool", submitted_review_count: 0 }, "shelf"],
    ["a pool digital album with no review waiting", { effective_state: "pool", submitted_review_count: 0, digital: true }, "shelf"],
    ["a disc a music director returned with a review waiting", returnedByMusicDirector, "office"],
    ["a digital album given back with a review waiting", { ...returnedByMusicDirector, digital: true }, "unplaced"],
    ["a reviewed disc that was returned", { effective_state: "reviewed", ...returned }, "office"],
    ["a reviewed digital album", { effective_state: "reviewed", ...returned, digital: true }, "burn"],
    ["a filed disc", { effective_state: "filed", submitted_review_count: 1 }, "filed"],
    ["a finalized digital album", { effective_state: "finalized", submitted_review_count: 1, digital: true }, "filed"],
  ])("%s", (_label, overrides, expected) => {
    expect(unheldPlace(intakeItem(overrides))).toBe(expected);
  });
});
