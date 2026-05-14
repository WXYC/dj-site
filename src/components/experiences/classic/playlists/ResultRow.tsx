"use client";

import type { PlaylistSearchResult } from "@wxyc/shared/dtos";
import type { Rotation } from "@/lib/features/rotation/types";
import { Capsule } from "@/src/components/experiences/classic/flowsheet/Capsule";
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

type CapsuleVariant = "request" | "rotation" | "exclusive";
type CapsuleSpec = { variant: CapsuleVariant; label: string };

// Same priority order as `capsulesForSongEntry` in the flowsheet.
function capsulesForResult(result: PreviousSetsResult): CapsuleSpec[] {
  const out: CapsuleSpec[] = [];
  if (result.request_flag) {
    out.push({ variant: "request", label: "REQUEST" });
  }
  if (result.rotation) {
    out.push({
      variant: "rotation",
      label: `ROTATION ${result.rotation}`,
    });
  }
  if (result.on_streaming === false) {
    out.push({ variant: "exclusive", label: "EXCLUSIVE" });
  }
  return out;
}

export default function ResultRow({
  result,
  nextIsTrack,
}: {
  result: PreviousSetsResult;
  nextIsTrack: boolean;
}) {
  const capsules = capsulesForResult(result);
  // Mirrors EntryRow's segue logic: a segue indicator only makes sense when
  // the next visible row is also a track. Tubafrenzy expresses the same
  // guard via `:has(+ tr.entry-row)`.
  const showSegue = result.segue === true && nextIsTrack;
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
