"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Button, Stack, Typography } from "@mui/joy";
import type { IntakeSlip } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import {
  isIntakeNotReviewed,
  useGetIntakeItemQuery,
  usePrintIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { useLazyGetReviewQuery } from "@/lib/features/reviews/reviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import { recordLine, intakeRecord } from "./recordLine";
import { formatSlipDate } from "./slipDate";
import SlipPreview from "./SlipPreview";

const COPY = REVIEW_COPY.intakeSlip;

// Prints the slip alone: the app chrome is hidden, the slip is laid at the page's corner.
const PRINT_CSS = `@media print {
  body * { visibility: hidden; }
  .review-slip-print, .review-slip-print * { visibility: visible; }
  .review-slip-print { position: absolute; left: 0; top: 0; }
}`;

/** The music directors' print page for one record's slip. The print request goes out on the press, never on load. */
export default function IntakeSlipScreen({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  const item = useGetIntakeItemQuery(id, { skip: !visible });
  const [print, { isLoading }] = usePrintIntakeItemMutation();
  const [slip, setSlip] = useState<IntakeSlip | null>(null);
  const [loadReview] = useLazyGetReviewQuery();
  // What the refusal was, decided only from the record as reloaded after it.
  const [refusal, setRefusal] = useState<"noCover" | "handwritten" | null>(null);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!visible) return null;
  if (hasNothingToShow(item) || reloadFailed) return <Typography role="alert">{REVIEW_COPY.intakeItem.loadFailed}</Typography>;
  if (!item.data) return null;

  const onPress = async () => {
    setRefusal(null);
    setFailed(false);
    try {
      const printed = await print(id).unwrap();
      // The slip must be in the document before the browser snapshots it.
      flushSync(() => setSlip(printed));
      window.print();
    } catch (err) {
      if (!isIntakeNotReviewed(err)) return setFailed(true);
      setSlip(null);
      // Reload first: the page as loaded may be older than the refusal.
      const reloaded = await item.refetch();
      const coverId = reloaded.data?.accepted_review_id;
      if (reloaded.isError || reloaded.data == null) return setReloadFailed(true);
      if (coverId == null) return setRefusal("noCover");
      const cover = await loadReview(coverId).unwrap().catch(() => null);
      if (cover == null) return setReloadFailed(true);
      // A typed review on the cover means a second press prints.
      if (cover.medium === "handwritten") setRefusal("handwritten");
      else setFailed(true);
    }
  };

  const lastPrinted = item.data.printed_at;
  return (
    <Stack spacing={2}>
      <style>{PRINT_CSS}</style>
      <Typography level="title-lg">{recordLine(intakeRecord(item.data))}</Typography>
      {lastPrinted && <Typography>{COPY.lastPrinted} {formatSlipDate(lastPrinted)}. {COPY.reprint}</Typography>}
      {refusal && <Typography role="alert">{COPY[refusal]}</Typography>}
      {refusal === "noCover" && (
        <Link href={`/dashboard/admin/intake/${id}`}>{COPY.backToRecord}</Link>
      )}
      {failed && <Typography role="alert">{REVIEW_COPY.screen.writeFailed}</Typography>}
      <Button loading={isLoading} onClick={onPress} sx={{ alignSelf: "flex-start" }}>
        {REVIEW_COPY.intakeItem.printSlip}
      </Button>
      {slip && (
        <div className="review-slip-print">
          <SlipPreview
            artist={slip.artist_name}
            album={slip.album_title}
            label={slip.record_label ?? ""}
            reviewer={slip.author ?? ""}
            date={slip.submitted_at ? formatSlipDate(slip.submitted_at) : ""}
            fields={slip}
            fccNotes={slip.fcc_notes.map((n) => `${n.track}: ${n.note}`)}
          />
        </div>
      )}
    </Stack>
  );
}
