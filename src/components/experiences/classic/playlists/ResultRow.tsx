"use client";

import type { PlaylistSearchResult } from "@wxyc/shared";
import { formatShortDate } from "@/src/components/experiences/classic/flowsheet/marker-format";
import { formatStationDateTime } from "@/src/utilities/stationTime";

export default function ResultRow({
  result,
}: {
  result: PlaylistSearchResult;
}) {
  // Station wall clock, not the reader's: a play logged after midnight UTC
  // belongs to the show that was on the air, and dating it by the reader's
  // zone files it under a day WXYC did not broadcast it.
  const { day } = formatStationDateTime(result.play_date);

  return (
    <tr>
      <td align="center">{formatShortDate(day)}</td>
      <td align="left">{result.artist_name}</td>
      <td align="left">{result.track_title}</td>
      <td align="left">{result.album_title}</td>
      <td align="left">{result.record_label}</td>
      <td align="left">{result.dj_name}</td>
    </tr>
  );
}
