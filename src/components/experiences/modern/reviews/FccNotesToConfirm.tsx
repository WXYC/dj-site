"use client";

import { useId, useState } from "react";
import { Link, Stack, Typography } from "@mui/joy";
import type { FccNote } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { useGetFccNotesToConfirmQuery } from "@/lib/features/reviews/fccNoteApi";
import { formatStationLongDate } from "@/src/utilities/stationTime";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import FccNoteActions, { useFccNoteViewer } from "./FccNoteActions";
import { REVIEW_COPY } from "./copy";

const copy = REVIEW_COPY.fccNotes;

/** A note can carry both ids once its record is filed; the album page is the preference. */
const recordHref = (note: FccNote) =>
  note.album_id != null ? `/dashboard/album/${note.album_id}` : `/dashboard/admin/intake/${note.intake_item_id}`;

/** Every FCC note nobody has confirmed yet, oldest first, for a music director to act on. */
export default function FccNotesToConfirm() {
  const visible = useCanSeeReviews();
  const { isMD } = useFccNoteViewer();
  const shown = visible && isMD;
  const notes = useGetFccNotesToConfirmQuery(undefined, { skip: !shown });
  // Kept here, not on the row: confirming the last note removes its row, and the reminder outlives it.
  const [reprint, setReprint] = useState(false);
  const titleId = useId();

  if (!shown) return null;
  if (hasNothingToShow(notes)) return <Typography role="alert">{copy.toConfirmLoadFailed}</Typography>;

  const rows = [...(notes.data ?? [])].sort((a, b) => a.reported_at.localeCompare(b.reported_at) || a.id - b.id);
  if (rows.length === 0 && !reprint) return null;

  return (
    <Stack component="section" aria-labelledby={titleId} spacing={1}>
      {rows.length > 0 && (
        <>
          <Typography id={titleId} level="title-sm">{copy.toConfirmTitle(rows.length)}</Typography>
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
            {rows.map((note) => (
              <Stack component="li" key={note.id} spacing={0.25} sx={{ listStyle: "none" }}>
                <Link href={recordHref(note)}>{copy.toConfirmRecord(note.artist_name, note.album_title)}</Link>
                <Typography>{copy.toConfirmNote(note.track, note.note)}</Typography>
                <Typography level="body-sm">
                  {copy.toConfirmReportedOn(note.reported_by, formatStationLongDate(note.reported_at))}
                </Typography>
                <FccNoteActions
                  note={note}
                  onConfirmed={() => setReprint(true)}
                  spoken={{
                    confirm: copy.toConfirmSpokenConfirm(note.artist_name, note.album_title, note.track),
                    remove: copy.toConfirmSpokenRemove(note.artist_name, note.album_title, note.track),
                  }}
                />
              </Stack>
            ))}
          </Stack>
        </>
      )}
      {reprint && <Typography role="status" level="body-sm">{copy.reprint}</Typography>}
    </Stack>
  );
}
