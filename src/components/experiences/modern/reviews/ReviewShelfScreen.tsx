"use client";

import { useRef } from "react";
import { Box, Button, Link, Typography } from "@mui/joy";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { IntakeItem, Reviewer } from "@wxyc/shared";
import { useCheckoutIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { useMounted } from "@/src/hooks/useRowWrite";
import { onReviewShelf } from "@/lib/features/reviews/holder";
import { byKind } from "@/lib/features/reviews/kind";
import { oldestLoggedFirst } from "@/lib/features/reviews/newMusic";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import ActionTooltip from "./ActionTooltip";
import { moveRowToTab } from "./flyToTab";
import RecordRow, { PRIMARY_CONTROL, type RecordRowTitle } from "./RecordRow";
import ReviewHint from "./ReviewHint";
import { intakeRecord } from "./recordLine";
import { useAskADj } from "./useAskADj";
import { day, type ReviewWrite } from "./useReviewWrite";

/** The review shelf lane, and for a music director the reviewers-load alert and each record's More menu. It assumes its caller has applied the `useCanSeeReviews` check and the load-failed gate, and takes the reviewers read and the `useReviewWrite` the caller built for this tab: My reviews is a separate tab with its own write wiring, so a lock set here does not carry over to it. */
export default function ReviewShelfScreen({ items, isMD, reviewers, write, lock }: { items: IntakeItem[]; isMD: boolean; reviewers: { isError: boolean; isLoading: boolean; data?: Reviewer[] } } & ReviewWrite) {
  const [checkout] = useCheckoutIntakeItemMutation();
  const router = useRouter();
  // A checkout outlives the screen when the DJ navigates away mid-click; the toast and the focus are skipped then.
  const mounted = useMounted();
  const laneRef = useRef<HTMLDivElement>(null);
  const onShelf = oldestLoggedFirst(items.filter(onReviewShelf));
  const { alert, moreMenu, shelfRecordId, shelfAlbumId } = useAskADj({ reviewers, write, lock });
  // A music director's row carries its own title link and the id the link carries; a DJ's row keeps the plain artist.
  const title = (i: IntakeItem): RecordRowTitle =>
    isMD ? { titleSlot: <Link level="title-md" id={shelfRecordId(i)} href={`/dashboard/admin/intake/${i.id}`}>{i.artist_name}</Link>, titleId: shelfRecordId(i) } : {};

  /** Moves the focus off a row that is about to leave: to the next row's main control, else the list. */
  const focusAfterLeaving = (row: HTMLElement | null) => {
    const next = row?.nextElementSibling?.querySelector<HTMLElement>(PRIMARY_CONTROL);
    (next ?? laneRef.current)?.focus();
  };

  return (
    <>
      {isMD && alert}
      <Typography>{REVIEW_COPY.screen.shelfLine}</Typography>
      <Box ref={laneRef} tabIndex={-1} sx={{ outline: "none" }}>
      <IntakeLane title={REVIEW_COPY.screen.shelfTitle} hideTitle rows={onShelf} empty={REVIEW_COPY.screen.shelfEmpty} row={(i) => (
        <RecordRow
          record={intakeRecord(i)}
          cover={72}
          {...title(i)}
          albumId={shelfAlbumId(i)}
          meta={
            <>
              <Typography level="body-sm">{`${REVIEW_COPY.screen.added} ${day(i.logged_at)}`}</Typography>
              {isMD && <ReviewHint artist={i.artist_name} album={i.album_title} />}
            </>
          }
          actions={
            <>
              <ActionTooltip title={byKind(i, { disc: REVIEW_COPY.tooltips.reviewDisc, digital: REVIEW_COPY.tooltips.reviewDigital })}><Button size="sm" {...lock(i.id, "checkout")} onClick={(event) => {
                  // Read before the await: React no longer holds the event's element afterwards.
                  const row = event.currentTarget.closest("li");
                  write(i.id, "checkout", async () => {
                    await checkout(i.id).unwrap();
                    if (!mounted.current) {
                      return;
                    }
                    toast(byKind(i, { disc: REVIEW_COPY.screen.yoursToReview, digital: REVIEW_COPY.screen.yoursToReviewDigital }), {
                      action: { label: REVIEW_COPY.screen.openIt, onClick: () => router.push(`/dashboard/reviews/mine?stage=open&highlight=${i.id}`) },
                    });
                    focusAfterLeaving(row);
                    if (row) {
                      await moveRowToTab(row, "/dashboard/reviews/mine");
                    }
                  });
                }}>{REVIEW_COPY.screen.review}</Button></ActionTooltip>
              {isMD && moreMenu(i)}
            </>
          }
        />
      )} />
      </Box>
    </>
  );
}
