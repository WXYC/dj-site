"use client";

import Link from "next/link";
import { Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { formatStationLongDate } from "@/src/utilities/stationTime";
import { REVIEW_COPY } from "./copy";
import { usePrintedVersion } from "./usePrintedVersion";

const copy = REVIEW_COPY.printedNote;

/**
 * Says whether the text shown is the version taped to the cover, from
 * `usePrintedVersion`.
 */
export default function PrintedVersionNote({ review, onCover, newSlipHref }: { review: Review; onCover: boolean; newSlipHref?: string }) {
  const state = usePrintedVersion(review, { onCover });

  if (state === "failed") return <Typography level="body-sm" role="alert">{copy.loadFailed}</Typography>;
  if (state === "current") return <Typography level="body-sm">{copy.isCurrent}</Typography>;
  if (state !== "edited" || !review.printed_at) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Typography level="body-sm">{copy.edited(formatStationLongDate(review.printed_at))}</Typography>
      <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history#printed`} level="body-sm">
        {copy.seePrinted}
      </JoyLink>
      {newSlipHref && (
        <JoyLink component={Link} href={newSlipHref} level="body-sm">{copy.printNew}</JoyLink>
      )}
    </Stack>
  );
}
