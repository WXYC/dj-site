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
    ["review", { review: "Spare." }, { review: "Spare." }],
    ["recommended_tracks", { recommended_tracks: "Back, Baby" }, { recommended_tracks: "Back, Baby" }],
    ["fcc_violations into fcc", { fcc_violations: "Track 2" }, { fcc: "Track 2" }],
    ["null fields left empty", { buzzwords: null, review: null, recommended_tracks: null, fcc_violations: null }, { buzzwords: "", review: "", recommended_tracks: "", fcc: "" }],
  ])("maps %s", (_label, overrides, expected) => {
    const start = formReviewStart(archived(overrides));

    expect(start.values).toMatchObject(expected);
    expect(start.medium).toBe("typed");
    expect(start.copied).toBe("form");
  });

  it("copies no artist paragraph from a form review that has one", () => {
    expect(formReviewStart(archived({ artist_blurb: "Chicago." })).values).not.toHaveProperty("artist_blurb");
  });

  it.each<{ label: string; reviewer: string | null | undefined; author: string }>([
    { label: "a name", reviewer: "Sam", author: "Sam" },
    { label: "a name with a date, as written", reviewer: "Sam 3/4", author: "Sam 3/4" },
    { label: "exactly the limit", reviewer: "a".repeat(AUTHOR_MAX), author: "a".repeat(AUTHOR_MAX) },
    { label: "past the limit, cut", reviewer: "a".repeat(AUTHOR_MAX + 5), author: "a".repeat(AUTHOR_MAX) },
    { label: "past the limit in code points, not units", reviewer: "😀".repeat(AUTHOR_MAX + 1), author: "😀".repeat(AUTHOR_MAX) },
    { label: "null", reviewer: null, author: "" },
    { label: "missing", reviewer: undefined, author: "" },
    { label: "blank", reviewer: "   ", author: "" },
  ])("reads a reviewer of $label as an author of $author", ({ reviewer, author }) => {
    const review = archived();
    if (reviewer === undefined) delete (review as Partial<AlbumReview>).reviewer;
    else review.reviewer = reviewer;

    expect(formReviewStart(review).author).toBe(author);
  });

  it.each<[string, number | null]>([
    ["a form review's id", formReviewStart(archived({ id: 77 })).copiedFrom],
    ["the empty start", EMPTY_START.copiedFrom],
    ["the paper start", PAPER_START.copiedFrom],
  ])("carries %s as copiedFrom", (label, copiedFrom) => {
    expect(copiedFrom).toBe(label === "a form review's id" ? 77 : null);
  });

  it("starts from the same empty values as the form opened by hand", () => {
    expect(Object.keys(formReviewStart(archived()).values)).toEqual(Object.keys(EMPTY_START.values));
    expect(PAPER_START).toMatchObject({ medium: "handwritten", copied: "paper", author: "" });
  });
});
