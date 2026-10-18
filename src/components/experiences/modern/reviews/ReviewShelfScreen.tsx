"use client";

import { Button, Link, Typography } from "@mui/joy";
import type { IntakeItem, Reviewer } from "@wxyc/shared";
import { useCheckoutIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { onReviewShelf } from "@/lib/features/reviews/holder";
import { byKind } from "@/lib/features/reviews/kind";
import { oldestLoggedFirst } from "@/lib/features/reviews/newMusic";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import RecordRow from "./RecordRow";
import { intakeRecord } from "./recordLine";
import { useAskADj } from "./useAskADj";
import { day, type ReviewWrite } from "./useReviewWrite";

/** The review shelf lane, and for a music director the reviewers-load alert and each record's Ask a DJ… button. It assumes its caller has applied the `useCanSeeReviews` check and the load-failed gate, and takes the reviewers read and the `useReviewWrite` the caller built for this tab: My reviews is a separate tab with its own write wiring, so a lock set here does not carry over to it. */
export default function ReviewShelfScreen({ items, isMD, reviewers, write, lock }: { items: IntakeItem[]; isMD: boolean; reviewers: { isError: boolean; isLoading: boolean; data?: Reviewer[] } } & ReviewWrite) {
  const [checkout] = useCheckoutIntakeItemMutation();
  const onShelf = oldestLoggedFirst(items.filter(onReviewShelf));
  const { alert, picker, shelfRecordId, shelfAlbumId } = useAskADj({ reviewers, write, lock });

  return (
    <>
      {isMD && alert}
      <Typography>{REVIEW_COPY.screen.shelfLine}</Typography>
      <IntakeLane title={REVIEW_COPY.screen.shelfTitle} hideTitle rows={onShelf} empty={REVIEW_COPY.screen.shelfEmpty} row={(i) => (
        <RecordRow
          record={intakeRecord(i)}
          cover={72}
          titleSlot={isMD ? <Link level="title-md" id={shelfRecordId(i)} href={`/dashboard/admin/intake/${i.id}`}>{i.artist_name}</Link> : undefined}
          albumId={shelfAlbumId(i)}
          meta={<Typography level="body-sm">{`${REVIEW_COPY.screen.added} ${day(i.logged_at)}`}</Typography>}
          actions={
            <>
              <Button size="sm" {...lock(i.id, "checkout")} onClick={() => write(i.id, "checkout", () => checkout(i.id).unwrap())}>{byKind(i, { disc: REVIEW_COPY.screen.checkOut, digital: REVIEW_COPY.screen.take })}</Button>
              {isMD && picker(i)}
            </>
          }
        />
      )} />
    </>
  );
}
