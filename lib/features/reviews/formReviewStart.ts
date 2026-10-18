import type { AlbumReview, NewReviewRequest } from "@wxyc/shared";
import { emptyFieldValues, type FieldValues } from "@/src/components/experiences/modern/reviews/SlipFields";

/** The longest author the service accepts, in code points. */
export const AUTHOR_MAX = 128;

/**
 * What the record form opens with: the author, the slip fields, the medium, and which copied-from lines it shows
 * (`form` for a review copied from the Google Form archive, `paper` for one that exists only on paper).
 * Names are real names: station display only, never telemetry.
 */
export type RecordFormStart = {
  author: string;
  values: FieldValues;
  medium: NonNullable<NewReviewRequest["medium"]>;
  copied: "form" | "paper" | null;
  /** The id of the form review the text was copied from, sent as `copied_from_submission_id` on the create; null when nothing was copied from one. */
  copiedFrom: number | null;
};

/** The form opened by hand: nothing copied, typed. */
export const EMPTY_START: RecordFormStart = { author: "", values: emptyFieldValues(), medium: "typed", copied: null, copiedFrom: null };

/** The form opened for a review that exists only on paper. */
export const PAPER_START: RecordFormStart = { ...EMPTY_START, medium: "handwritten", copied: "paper" };

/** Maps one archived form review onto the form's starting values; null fields stay empty, a blank reviewer leaves the author blank. */
export function formReviewStart(review: AlbumReview): RecordFormStart {
  const values: FieldValues = { ...EMPTY_START.values };
  for (const name of ["buzzwords", "review", "recommended_tracks"] as const) values[name] = review[name] ?? "";
  values.fcc = review.fcc_violations ?? "";
  const reviewer = review.reviewer?.trim() ? review.reviewer : "";
  return { ...EMPTY_START, values, author: [...reviewer].slice(0, AUTHOR_MAX).join(""), copied: "form", copiedFrom: review.id };
}
