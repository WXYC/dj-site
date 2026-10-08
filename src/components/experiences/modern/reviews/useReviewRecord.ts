import type { Review } from "@wxyc/shared";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { useGetIntakeItemQuery } from "@/lib/features/reviews/api";
import { intakeRecord } from "./recordLine";

export type ReviewRecord = {
  artist: string;
  album: string;
  label: string;
  /** Set for an intake record, which carries a format id rather than a name. */
  formatId?: number | null;
  /** Set for a library release, which carries its format name. */
  format?: string;
};

/**
 * The record a review is about, read from the review's own subject: the intake
 * item for an intake review, the library release for a library-release review.
 * `undefined` until the read lands.
 */
export function useReviewRecord(review: Review): ReviewRecord | undefined {
  const intake = useGetIntakeItemQuery(review.intake_item_id != null ? review.intake_item_id : skipToken);
  const album = useGetInformationQuery(
    review.intake_item_id == null && review.album_id != null ? { album_id: review.album_id } : skipToken,
  );
  if (intake.data) {
    return intakeRecord(intake.data);
  }
  if (album.data) {
    return { artist: album.data.artist.name, album: album.data.title, label: album.data.label, format: album.data.format };
  }
  return undefined;
}
