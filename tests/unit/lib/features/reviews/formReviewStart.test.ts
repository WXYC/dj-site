import { describe, it, expect } from "vitest";
import type { AlbumReview } from "@wxyc/shared";
import { AUTHOR_MAX, EMPTY_START, PAPER_START, formReviewStart } from "@/lib/features/reviews/formReviewStart";

const archived = (overrides: Partial<AlbumReview> = {}): AlbumReview => ({
  id: 7,
  reviewer: "Sam",
  album_id: 3,
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  artist_blurb: "Buenos Aires.",
  review: "Warm and strange.",
  recommended_tracks: "la paradoja",
  buzzwords: "folktronica",
  fcc_violations: "None.",
  review_purpose: null,
  rotated: null,
  released_within_six_months: null,
  social_consent: null,
  submitted_at: null,
  ...overrides,
});

describe("formReviewStart", () => {
  it.each<[string, Partial<AlbumReview>, Partial<ReturnType<typeof formReviewStart>["values"]>]>([
    ["buzzwords", { buzzwords: "drone" }, { buzzwords: "drone" }],
    ["artist_blurb", { artist_blurb: "Chicago." }, { artist_blurb: "Chicago." }],
    ["review", { review: "Spare." }, { review: "Spare." }],
    ["recommended_tracks", { recommended_tracks: "Back, Baby" }, { recommended_tracks: "Back, Baby" }],
    ["fcc_violations into fcc", { fcc_violations: "Track 2" }, { fcc: "Track 2" }],
    ["null fields left empty", { buzzwords: null, artist_blurb: null, review: null, recommended_tracks: null, fcc_violations: null }, { buzzwords: "", artist_blurb: "", review: "", recommended_tracks: "", fcc: "" }],
  ])("maps %s", (_label, overrides, expected) => {
    const start = formReviewStart(archived(overrides));

    expect(start.values).toMatchObject(expected);
    expect(start.medium).toBe("typed");
    expect(start.copied).toBe("form");
  });

  it.each<[string, string | null | undefined, string]>([
    ["a name", "Sam", "Sam"],
    ["a name with a date, as written", "Sam 3/4", "Sam 3/4"],
    ["exactly the limit", "a".repeat(AUTHOR_MAX), "a".repeat(AUTHOR_MAX)],
    ["past the limit, cut", "a".repeat(AUTHOR_MAX + 5), "a".repeat(AUTHOR_MAX)],
    ["past the limit in code points, not units", "😀".repeat(AUTHOR_MAX + 1), "😀".repeat(AUTHOR_MAX)],
    ["null", null, ""],
    ["missing", undefined, ""],
    ["blank", "   ", ""],
  ])("reads a reviewer of %s as an author of %j", (_label, reviewer, author) => {
    const review = archived();
    if (reviewer === undefined) delete (review as Partial<AlbumReview>).reviewer;
    else review.reviewer = reviewer;

    expect(formReviewStart(review).author).toBe(author);
  });

  it("starts from the same empty values as the form opened by hand", () => {
    expect(Object.keys(formReviewStart(archived()).values)).toEqual(Object.keys(EMPTY_START.values));
    expect(PAPER_START).toMatchObject({ medium: "handwritten", copied: "paper", author: "" });
  });
});
