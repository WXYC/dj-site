import { describe, it, expect } from "vitest";
import type { IntakeItem, Review } from "@wxyc/shared";
import { rowKey, sortMyReviews, STAGES, type MyReviewsRow } from "@/lib/features/reviews/myReviews";
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
  it.each<[string, IntakeItem[], Review[], { open: string[]; submitted: string[]; published: string[] }]>([
    [
      "a request to me is open",
      [intakeItem({ id: 1, state: "requested", effective_state: "requested", ...requestedFor(ME, "DJ Me") })],
      [],
      { open: ["request-1"], submitted: [], published: [] },
    ],
    [
      "a lapsed request is nowhere",
      [intakeItem({ id: 1, state: "requested", effective_state: "pool", ...requestedFor(ME, "DJ Me") })],
      [],
      { open: [], submitted: [], published: [] },
    ],
    [
      "a request to someone else is nowhere",
      [intakeItem({ id: 1, state: "requested", effective_state: "requested", ...requestedFor("dj-other", "DJ Other") })],
      [],
      { open: [], submitted: [], published: [] },
    ],
    ["a record I hold with no review is open", [held(2)], [], { open: ["held-2"], submitted: [], published: [] }],
    ["a record I hold with a draft is open, once", [held(2)], [draft(10, 2)], { open: ["held-2"], submitted: [], published: [] }],
    [
      "a record I hold with a submitted review is submitted",
      [held(2)],
      [submitted(10, 2)],
      { open: [], submitted: ["held-2"], published: [] },
    ],
    [
      "a disc I hold whose review was chosen is published",
      [held(2, { state: "reviewed", effective_state: "reviewed" })],
      [submitted(10, 2, { in_use: true })],
      { open: [], submitted: [], published: ["held-2"] },
    ],
    [
      "a held record with a draft and a submitted review sits once, under the submitted review",
      [held(2)],
      [draft(11, 2), submitted(10, 2)],
      { open: [], submitted: ["held-2"], published: [] },
    ],
    [
      "a held record goes to the stage of its newest submitted review, and an older one is listed on its own",
      [held(2)],
      [submitted(10, 2, { in_use: true, submitted_at: "2026-10-01T12:00:00Z" }), submitted(11, 2, { submitted_at: "2026-10-09T12:00:00Z" })],
      { open: [], submitted: ["held-2"], published: ["review-10"] },
    ],
    [
      "a held record whose newest submitted review was chosen is published, whatever order the list comes in",
      [held(2)],
      [submitted(11, 2, { in_use: true, submitted_at: "2026-10-09T12:00:00Z" }), submitted(10, 2, { submitted_at: "2026-10-01T12:00:00Z" })],
      { open: [], submitted: ["review-10"], published: ["held-2"] },
    ],
    ["a draft on a record I no longer have is open", [intakeItem({ id: 3 })], [draft(10, 3)], { open: ["review-10"], submitted: [], published: [] }],
    ["a draft of a library release is open", [], [draft(10, null, { album_id: 7 })], { open: ["review-10"], submitted: [], published: [] }],
    ["a submitted review not in use is submitted", [], [submitted(10, 3)], { open: [], submitted: ["review-10"], published: [] }],
    ["a submitted review in use is published", [], [submitted(10, 3, { in_use: true })], { open: [], submitted: [], published: ["review-10"] }],
    [
      "someone else's hold is not mine",
      [held(2, { checked_out_by: "dj-other" })],
      [],
      { open: [], submitted: [], published: [] },
    ],
  ])("%s", (_name, items, reviews, expected) => {
    const lanes = sortMyReviews(items, reviews, ME);

    expect({ open: keys(lanes.open), submitted: keys(lanes.submitted), published: keys(lanes.published) }).toEqual(expected);
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

  it("lists drafts in Open reviews newest saved first, after requests and records I have", () => {
    const lanes = sortMyReviews(
      [held(1)],
      [
        draft(10, null, { last_modified: "2026-10-01T12:00:00Z" }),
        draft(11, null, { last_modified: "2026-10-09T12:00:00Z" }),
        draft(12, null, { last_modified: "2026-10-05T12:00:00Z" }),
      ],
      ME,
    );

    expect(keys(lanes.open)).toEqual(["held-1", "review-11", "review-12", "review-10"]);
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

  // The `?stage=` tokens: links and bookmarks name a stage by these, so they stay lowercase slugs whatever the chips say.
  it("names the stages open, submitted and published, in chip order", () => {
    expect(STAGES).toEqual(["open", "submitted", "published"]);
  });

  it("finds nothing of mine when the account is unknown", () => {
    expect(sortMyReviews([held(2)], [], undefined).open).toEqual([]);
  });
});
