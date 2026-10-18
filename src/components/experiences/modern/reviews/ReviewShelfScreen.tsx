"use client";

import { Button, Link, Typography } from "@mui/joy";
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
import RecordRow, { focusAfterRowLeaves, neighboursOf, PRIMARY_ACTION_PROPS, type RecordRowTitle } from "./RecordRow";
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
  const onShelf = oldestLoggedFirst(items.filter(onReviewShelf));
  const { alert, moreMenu, shelfRecordId, shelfAlbumId } = useAskADj({ reviewers, write, lock });
  // A music director's row carries its own title link and the id the link carries; a DJ's row keeps the plain artist.
  const title = (i: IntakeItem): RecordRowTitle =>
    isMD ? { titleSlot: <Link level="title-md" id={shelfRecordId(i)} href={`/dashboard/admin/intake/${i.id}`}>{i.artist_name}</Link>, titleId: shelfRecordId(i) } : {};

  return (
    <>
      {isMD && alert}
      <Typography>{REVIEW_COPY.screen.shelfLine}</Typography>
      <IntakeLane title={REVIEW_COPY.screen.shelfTitle} hideTitle focusable rows={onShelf} empty={REVIEW_COPY.screen.shelfEmpty} row={(i) => (
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
              <ActionTooltip title={byKind(i, { disc: REVIEW_COPY.tooltips.reviewDisc, digital: REVIEW_COPY.tooltips.reviewDigital })}><Button size="sm" {...PRIMARY_ACTION_PROPS} {...lock(i.id, "checkout")} onClick={(event) => {
                  // Read before the write, while the row is drawn: React no longer holds the event's element afterwards, and a reload can take the row, and its neighbours with it, off the page before the write returns.
                  const row = event.currentTarget.closest("li");
                  const neighbours = neighboursOf(row);
                  const lane = event.currentTarget.closest<HTMLElement>("section");
                  write(i.id, "checkout", async () => {
                    await checkout(i.id).unwrap();
                    if (!mounted.current) {
                      return;
                    }
                    toast(byKind(i, { disc: REVIEW_COPY.screen.yoursToReview, digital: REVIEW_COPY.screen.yoursToReviewDigital }), {
                      action: { label: REVIEW_COPY.screen.openIt, onClick: () => router.push(`/dashboard/reviews/mine?stage=open&highlight=${i.id}`) },
                    });
                    focusAfterRowLeaves(neighbours, lane);
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
    </>
  );
}
