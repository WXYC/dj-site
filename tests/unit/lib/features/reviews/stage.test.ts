import { describe, it, expect } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { recordStage, reviewWaiting, type ReviewStage } from "@/lib/features/reviews/holder";
import { intakeItem, returnedByMusicDirector } from "@/tests/fakes/reviews";

// A submitted review that no music director has chosen yet: what the server's awaiting_acceptance filter keeps.
const waits: Partial<IntakeItem> = { submitted_review_count: 1, accepted_review_id: null };
// A submitted review whose record already has a chosen one.
const chosen: Partial<IntakeItem> = { submitted_review_count: 2, accepted_review_id: 70 };

describe("recordStage", () => {
  it.each<[string, Partial<IntakeItem>, ReviewStage]>([
    ["a filed record", { effective_state: "filed" }, "filed"],
    ["a finalized record", { effective_state: "finalized" }, "filed"],
    ["a filed record with a submitted review nobody chose", { effective_state: "filed", ...waits }, "filed"],
    ["a finalized record with a submitted review nobody chose", { effective_state: "finalized", ...waits }, "filed"],
    ["a reviewed record", { effective_state: "reviewed", accepted_review_id: 70 }, "reviewed"],
    ["a reviewed record with another submitted review", { effective_state: "reviewed", ...chosen }, "reviewed"],
    ["a reviewed record with a submitted review and no chosen one", { effective_state: "reviewed", ...waits }, "reviewed"],
    ["a checked out record with a waiting review", { effective_state: "checked_out", ...waits }, "waiting"],
    ["a requested record with a waiting review", { effective_state: "requested", ...waits }, "waiting"],
    ["a pool record with a waiting review", { effective_state: "pool", ...waits }, "waiting"],
    ["a disc a music director marked as returned with its review waiting", returnedByMusicDirector, "waiting"],
    ["a checked out record whose submitted review was already chosen", { effective_state: "checked_out", ...chosen }, "being_reviewed"],
    ["a requested record", { effective_state: "requested" }, "requested"],
    ["a request that has lapsed (stored requested, read as pool)", { state: "requested", effective_state: "pool" }, "review_shelf"],
    ["a checked out record", { effective_state: "checked_out" }, "being_reviewed"],
    ["a pool record", { effective_state: "pool" }, "review_shelf"],
  ])("puts %s in its stage", (_label, overrides, expected) => {
    expect(recordStage(intakeItem({ id: 7, ...overrides }))).toBe(expected);
  });
});

describe("reviewWaiting", () => {
  // The server's awaiting_acceptance filter: submitted_review_count > 0, accepted_review_id null, a state before filed.
  it.each<[string, Partial<IntakeItem>, boolean]>([
    ["a submitted review and none chosen", { effective_state: "checked_out", ...waits }, true],
    ["no submitted review", { effective_state: "checked_out" }, false],
    ["a chosen review", { effective_state: "checked_out", ...chosen }, false],
    ["a filed state", { effective_state: "filed", ...waits }, false],
    ["a finalized state", { effective_state: "finalized", ...waits }, false],
  ])("answers for a record with %s", (_label, overrides, expected) => {
    expect(reviewWaiting(intakeItem(overrides))).toBe(expected);
  });
});
