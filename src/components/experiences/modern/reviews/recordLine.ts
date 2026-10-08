import type { IntakeItem } from "@wxyc/shared";
import type { ReviewRecord } from "./useReviewRecord";

export function intakeRecord(item: IntakeItem): ReviewRecord {
  return { artist: item.artist_name, album: item.album_title, label: item.record_label ?? "", formatId: item.format_id };
}

/** A record's one-line description; a format name on the record wins over a `formatId` lookup. */
export function recordLine(record: ReviewRecord, formats?: { id: number; format_name: string }[]): string {
  const format = record.format ?? formats?.find((f) => f.id === record.formatId)?.format_name;
  return [record.artist, record.album, record.label, format].filter(Boolean).join(" · ");
}
