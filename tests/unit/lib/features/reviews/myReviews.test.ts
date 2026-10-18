import { describe, it, expect } from "vitest";
import type { IntakeItem, Review } from "@wxyc/shared";
import { rowKey, sortMyReviews, type MyReviewsRow } from "@/lib/features/reviews/myReviews";
import { heldBy, intakeItem, requestedFor, review } from "@/tests/fakes/reviews";

const ME = "dj-me";
const held = (id: number, overrides: Partial<IntakeItem> = {}) =>
  intakeItem({ id, state: "checked_out", effective_state: "checked_out", ...heldBy(ME, "DJ Me"), ...overrides });
const submitted = (id: number, intake_item_id: number | null, overrides: Partial<Review> = {}) =>
  review({ id, intake_item_id, status: "submitted", in_use: false, submitted_at: "2026-10-07T16:00:00Z", ...overrides });
const draft = (id: number, intake_item_id: number | null, overrides: Partial<Review> = {}) =>
  review({ id, intake_item_id, status: "draft", ...overrides });

/** A row as `[kind, id]`, so a table names which record or review sits where. */
const keys = (rows: MyReviewsRow[]) => rows.map(rowKey);

describe("sortMyReviews", () => {
  it.each<[string, IntakeItem[], Review[], { open: string[]; submitted: string[]; cover: string[] }]>([
    [
      "a request to me is open",
      [intakeItem({ id: 1, state: "requested", effective_state: "requested", ...requestedFor(ME, "DJ Me") })],
      [],
      { open: ["request-1"], submitted: [], cover: [] },
    ],
    [
      "a lapsed request is nowhere",
      [intakeItem({ id: 1, state: "requested", effective_state: "pool", ...requestedFor(ME, "DJ Me") })],
      [],
      { open: [], submitted: [], cover: [] },
    ],
    [
      "a request to someone else is nowhere",
      [intakeItem({ id: 1, state: "requested", effective_state: "requested", ...requestedFor("dj-other", "DJ Other") })],
      [],
      { open: [], submitted: [], cover: [] },
    ],
    ["a record I hold with no review is open", [held(2)], [], { open: ["held-2"], submitted: [], cover: [] }],
    ["a record I hold with a draft is open, once", [held(2)], [draft(10, 2)], { open: ["held-2"], submitted: [], cover: [] }],
    [
      "a record I hold with a submitted review is submitted",
      [held(2)],
      [submitted(10, 2)],
      { open: [], submitted: ["held-2"], cover: [] },
    ],
    [
      "a disc I hold whose review was chosen is on the cover",
      [held(2, { state: "reviewed", effective_state: "reviewed" })],
      [submitted(10, 2, { in_use: true })],
      { open: [], submitted: [], cover: ["held-2"] },
    ],
    [
      "a held record with a draft and a submitted review sits once, under the submitted review",
      [held(2)],
      [draft(11, 2), submitted(10, 2)],
      { open: [], submitted: ["held-2"], cover: [] },
    ],
    ["a draft on a record I no longer have is open", [intakeItem({ id: 3 })], [draft(10, 3)], { open: ["review-10"], submitted: [], cover: [] }],
    ["a draft of a library release is open", [], [draft(10, null, { album_id: 7 })], { open: ["review-10"], submitted: [], cover: [] }],
    ["a submitted review not in use is submitted", [], [submitted(10, 3)], { open: [], submitted: ["review-10"], cover: [] }],
    ["a submitted review in use is on the cover", [], [submitted(10, 3, { in_use: true })], { open: [], submitted: [], cover: ["review-10"] }],
    [
      "someone else's hold is not mine",
      [held(2, { checked_out_by: "dj-other" })],
      [],
      { open: [], submitted: [], cover: [] },
    ],
  ])("%s", (_name, items, reviews, expected) => {
    const lanes = sortMyReviews(items, reviews, ME);

    expect({ open: keys(lanes.open), submitted: keys(lanes.submitted), cover: keys(lanes.cover) }).toEqual(expected);
  });

  it("orders Open reviews as requests, then overdue records, then the rest", () => {
    const lanes = sortMyReviews(
      [
        held(1),
        held(2, { overdue: true }),
        intakeItem({ id: 3, state: "requested", effective_state: "requested", ...requestedFor(ME, "DJ Me") }),
        intakeItem({ id: 4 }),
      ],
      [draft(10, 4), draft(11, null)],
      ME,
    );

    expect(keys(lanes.open)).toEqual(["request-3", "held-2", "held-1", "review-10", "review-11"]);
  });

  it.each<[string, Review[], string[]]>([
    [
      "by the day it was submitted",
      [submitted(1, null, { submitted_at: "2026-10-01T12:00:00Z" }), submitted(2, null, { submitted_at: "2026-10-09T12:00:00Z" }), submitted(3, null, { submitted_at: "2026-10-05T12:00:00Z" })],
      ["review-2", "review-3", "review-1"],
    ],
    [
      "by last save when no submission time is recorded",
      [submitted(1, null, { submitted_at: null, last_modified: "2026-10-01T12:00:00Z" }), submitted(2, null, { submitted_at: null, last_modified: "2026-10-09T12:00:00Z" })],
      ["review-2", "review-1"],
    ],
  ])("lists Submitted newest first, %s", (_name, reviews, expected) => {
    expect(keys(sortMyReviews([], reviews, ME).submitted)).toEqual(expected);
  });

  it("finds nothing of mine when the account is unknown", () => {
    expect(sortMyReviews([held(2)], [], undefined).open).toEqual([]);
  });
});
