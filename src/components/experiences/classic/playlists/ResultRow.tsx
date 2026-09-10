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
  // Null for a play that belongs to no show; the row then carries neither the
  // link nor the hover affordance that would promise one.
  const href = hrefForShowEntry(result.show_id, result.id);

  return (
    <tr className={href ? "classic-previous-sets-row" : undefined}>
      <td align="center">
        {href ? (
          <Link
            className="classic-previous-sets-row-link"
            href={href}
            // Leads with the date so the Date column's own content survives:
            // an aria-label replaces the link's text outright, and nothing
            // else on the row announces when the play aired.
            aria-label={`${date} — see the full show for ${result.track_title} by ${result.artist_name}`}
            // The destination is this same route with a different query, and
            // the show itself is a client query, so a per-row prefetch on an
            // infinitely scrolling listing buys nothing.
            prefetch={false}
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
