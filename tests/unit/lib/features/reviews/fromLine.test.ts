import { describe, it, expect } from "vitest";
import type { IntakeItem, Review } from "@wxyc/shared";
import { fromLine } from "@/src/components/experiences/modern/reviews/ReviewFrom";
import { intakeItem, review } from "@/tests/fakes/reviews";

const HELD_BY_JESS = { effective_state: "checked_out", checked_out_by: "dj-jess", checked_out_by_name: "Jessica Pratt", checked_out_at: "2026-09-20T12:00:00Z" } as const;
const HELD_BY_SAM = { effective_state: "checked_out", checked_out_by: "dj-sam", checked_out_by_name: "DJ Sam", checked_out_at: "2026-09-20T12:00:00Z" } as const;
const REMOVED_HOLDER = { effective_state: "checked_out", checked_out_by: null, checked_out_by_name: null, checked_out_at: "2026-09-20T12:00:00Z" } as const;
const REQUESTED_BY_PAT = { effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat", requested_at: "2026-09-25T12:00:00Z" } as const;
// A live request that names who it is held for but carries no account id.
const REQUESTED_NO_ACCOUNT = { effective_state: "requested", requested_dj_name: "DJ Pat" } as const;

const FROM_JESS: Partial<Review> = { author: "Jessica Pratt", author_user_id: "dj-jess" };

describe("fromLine", () => {
  it.each<[string, Partial<IntakeItem>, Partial<Review>, string | null]>([
    ["the author is the DJ who has the record", HELD_BY_JESS, FROM_JESS, "From Jessica Pratt, who has this record."],
    ["someone else wrote it and a DJ has the record", HELD_BY_SAM, FROM_JESS, "From Jessica Pratt. The record is with DJ Sam."],
    ["someone else wrote it and a request is open", REQUESTED_BY_PAT, FROM_JESS, "From Jessica Pratt. The record is being held for DJ Pat."],
    ["someone else wrote it and the holder's account was removed", REMOVED_HOLDER, FROM_JESS, "From Jessica Pratt. The record is checked out; holder removed."],
    ["someone else wrote it and the record is on the review shelf", { effective_state: "pool" }, FROM_JESS, "From Jessica Pratt. The record is on the review shelf."],
    ["the author is the DJ the record is held for", REQUESTED_BY_PAT, { author: "DJ Pat", author_user_id: "dj-pat" }, "From DJ Pat, who has this record."],
    ["the review has no linked account, it never matches the DJ who has the record", HELD_BY_JESS, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is with Jessica Pratt."],
    ["the review has no linked account and a request names no account, it still matches nobody", REQUESTED_NO_ACCOUNT, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is being held for DJ Pat."],
    ["the review has no linked account and the holder's account was removed", REMOVED_HOLDER, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is checked out; holder removed."],
    ["the review has no linked account and the record is on the review shelf", { effective_state: "pool" }, { ...FROM_JESS, author_user_id: null }, "From Jessica Pratt. The record is on the review shelf."],
    ["nobody has the record and it is no longer on the review shelf", { effective_state: "reviewed" }, FROM_JESS, null],
    ["nobody has a filed record", { effective_state: "filed" }, FROM_JESS, null],
    ["the author is unknown", HELD_BY_SAM, { author: null }, null],
  ])("when %s", (_label, itemOverrides, reviewOverrides, expected) => {
    expect(fromLine(review({ status: "submitted", ...reviewOverrides }), intakeItem(itemOverrides))).toBe(expected);
  });
});
