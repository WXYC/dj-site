import type { IntakeItem } from "@wxyc/shared";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { formatLabel } from "@/lib/features/experiences/modern/tokens/roles";
import type { ReviewRecord } from "./useReviewRecord";

export function intakeRecord(item: IntakeItem): ReviewRecord {
  return { artist: item.artist_name, album: item.album_title, label: item.record_label ?? "", formatId: item.format_id };
}

/** A catalog release as a record: the artist, the title and the format name the library holds, with no label. */
export function releaseRecord(release: AlbumEntry): ReviewRecord {
  return { artist: release.artist.name, album: release.title, label: "", format: release.format };
}

/** The record's format name; a name on the record wins over a `formatId` lookup. */
export function recordFormatName(record: ReviewRecord, formats?: { id: number; format_name: string }[]): string | undefined {
  return record.format ?? formats?.find((f) => f.id === record.formatId)?.format_name;
}

/** A record's one-line description. */
export function recordLine(record: ReviewRecord, formats?: { id: number; format_name: string }[]): string {
  const name = recordFormatName(record, formats);
  const format = name && formatLabel(name);
  return [record.artist, record.album, record.label, format].filter(Boolean).join(" · ");
}
