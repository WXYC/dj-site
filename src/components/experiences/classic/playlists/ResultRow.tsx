"use client";

import Link from "next/link";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { formatShortDate } from "@/src/components/experiences/classic/flowsheet/marker-format";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import { hrefForShowEntry } from "@/lib/features/schedule-week/showUrl";

export default function ResultRow({
  result,
}: {
  result: PlaylistSearchResult;
}) {
  // Station wall clock, not the reader's: a play logged after midnight UTC
  // belongs to the show that was on the air, and dating it by the reader's
  // zone files it under a day WXYC did not broadcast it.
  const { day } = formatStationDateTime(result.play_date);
  const date = formatShortDate(day);

  return (
    <tr className="classic-previous-sets-row">
      <td align="center">
        {/* The backend projects a flowsheet row with a null show_id as 0, and
            no show has that id. Such a play is shown plain rather than linked
            to a page that can only report the show missing. */}
        {result.show_id > 0 ? (
          <Link
            className="classic-previous-sets-row-link"
            href={hrefForShowEntry(result.show_id, result.id)}
            aria-label={`See the full show for ${result.track_title} by ${result.artist_name}`}
          >
            {date}
          </Link>
        ) : (
          date
        )}
      </td>
      <td align="left">{result.artist_name}</td>
      <td align="left">{result.track_title}</td>
      <td align="left">{result.album_title}</td>
      <td align="left">{result.record_label}</td>
      <td align="left">{result.dj_name}</td>
    </tr>
  );
}
