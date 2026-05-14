"use client";

import type { PlaylistSearchResult } from "@wxyc/shared/dtos";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  Capsule,
  capsulesForSongEntry,
} from "@/src/components/experiences/classic/flowsheet/Capsule";
import "@/src/styles/classic/segue.css";

// PlaylistSearchResult plus the optional flags that drive capsules + segue.
// Backend may not yet surface every flag on every result; the row simply
// suppresses the capsule when the corresponding field is absent.
export type PreviousSetsResult = PlaylistSearchResult & {
  request_flag?: boolean;
  rotation?: Rotation;
  on_streaming?: boolean;
  segue?: boolean;
};

export default function ResultRow({
  result,
  nextIsSong,
}: {
  result: PreviousSetsResult;
  /** True if the next row in the table is also a song row. Mirrors
   *  EntryRow's `nextIsSong` prop so the Classic segue contract stays
   *  unified across flowsheet + playlist archive. */
  nextIsSong: boolean;
}) {
  // Shared capsule resolver — same priority order (REQUEST → ROTATION →
  // EXCLUSIVE) and label format as the flowsheet song row.
  const capsules = capsulesForSongEntry(result);
  // Mirrors EntryRow's segue logic: a segue indicator only makes sense when
  // the next visible row is also a song row. Tubafrenzy expresses the same
  // guard via `:has(+ tr.entry-row)`.
  const showSegue = result.segue === true && nextIsSong;
  const className = showSegue ? "classic-segue" : undefined;

  return (
    <tr className={className} data-segue={showSegue ? "true" : undefined}>
      <td align="center" style={{ width: "5%" }}>
        {capsules.map((c) => (
          <Capsule key={c.variant} variant={c.variant} label={c.label} />
        ))}
      </td>
      <td align="left" style={{ width: "25%" }}>
        {result.artist_name}
      </td>
      <td align="left">{result.track_title}</td>
      <td align="left">{result.album_title}</td>
      <td align="left">{result.record_label}</td>
    </tr>
  );
}
