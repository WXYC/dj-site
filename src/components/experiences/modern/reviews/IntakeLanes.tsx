"use client";

import { useState, type ReactNode } from "react";
import { Button, Chip, Link, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import {
  isIntakeRequestRefused,
  isIntakeStateChanged,
  intakeApi,
  useCancelIntakeRequestMutation,
  useGetIntakeItemsQuery,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { LIVE_LIST } from "@/lib/features/reviews/api";
import { itemHolder, recordStage, type ReviewStage } from "@/lib/features/reviews/holder";
import { byKind, recordKind } from "@/lib/features/reviews/kind";
import { filedByRecency, NEW_MUSIC_STAGES, oldestLoggedFirst } from "@/lib/features/reviews/newMusic";
import { reviewApi, useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import StageChips from "../StageChips";
import FccNotesToConfirm from "./FccNotesToConfirm";
import HeadedSection from "./HeadedSection";
import { REVIEW_COPY } from "./copy";
import RecordRow from "./RecordRow";
import { intakeRecord } from "./recordLine";
import { whereLine, WaitingFrom } from "./ReviewFrom";
import { useAskADj, type AskWrite } from "./useAskADj";
import { day, EVERY_STATE } from "./useReviewWrite";
import { formatStationShortDate } from "@/src/utilities/stationTime";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";

const COPY = REVIEW_COPY.intake;

// The stages are one read, the unfiltered one (`EVERY_STATE`, shared with the Reviewing tab and the tab count), with each
// row drawn in the stage `recordStage` gives it, so a record is in exactly one stage.

// `release` is Being reviewed's Return to the review shelf; `return` is Mark as returned, on the Reviewed stage and on a
// Review waiting disc. Both call /release. `request` and `cancel` are the Ask a DJ… control's writes.
type Action = "request" | "cancel" | "release" | "return";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const RACE_NOTICE: Record<Action, string> = {
  request: COPY.raceRequest,
  cancel: COPY.raceCancel,
  release: COPY.raceCheckoutReleased,
  return: COPY.raceReleased,
};

const RECENT_PASSES = 5;

const STAGE_LABEL: Record<ReviewStage, string> = {
  review_shelf: COPY.onShelf,
  requested: COPY.requested,
  being_reviewed: COPY.beingReviewed,
  waiting: COPY.waiting,
  reviewed: COPY.reviewed,
  filed: COPY.filed,
};

/** A confirmation that is open: Return to the review shelf (`release`) or a Review waiting disc's Mark as returned (`return`). */
type Confirming = { item: IntakeItem; action: "release" | "return" };

/** The open confirmation's words. A removed holder has no name to give, and nobody to ask to bring a disc back. */
function confirmation({ item, action }: Confirming): { title: string; body: string; confirm: string } {
  const holder = itemHolder(item);
  const name = "name" in holder ? holder.name : null;
  if (action === "return") {
    return {
      title: COPY.markReturnedQuestion(item.artist_name, item.album_title),
      body: name ? COPY.markReturnedBody(name) : COPY.markReturnedBodyRemoved,
      confirm: COPY.returned,
    };
  }
  return {
    title: COPY.returnQuestion(item.artist_name, item.album_title),
    body: name ? byKind(item, { disc: `${COPY.returnBody(name)} ${COPY.returnBringDisc}`, digital: COPY.returnBody(name) }) : COPY.returnBodyRemoved,
    confirm: REVIEW_COPY.screen.returnToShelf,
  };
}

/** The music directors' tab: the FCC notes waiting on them, read on their own, above the intake lanes. */
export default function IntakeLanes() {
  if (!useCanSeeReviews()) return null;
  return (
    <Stack spacing={3}>
      <FccNotesToConfirm />
      <IntakeLaneGroups />
    </Stack>
  );
}

/** A stage's records as a list, or the approved empty line. */
function RowList({ rows, row }: { rows: IntakeItem[]; row: (i: IntakeItem) => ReactNode }) {
  if (rows.length === 0) {
    return <Typography level="body-sm">{COPY.empty}</Typography>;
  }
  return (
    <List>
      {rows.map((i) => (
        <ListItem key={i.id}>{row(i)}</ListItem>
      ))}
    </List>
  );
}

/** Draws one record's row. `title` replaces the artist link, for a control whose label points at it. */
type LaneRow = (i: IntakeItem, meta?: ReactNode, actions?: ReactNode, title?: { titleSlot: ReactNode; albumId: string }) => ReactNode;

const itemHref = (i: IntakeItem) => `/dashboard/admin/intake/${i.id}`;

/** On the review shelf: each record with its Ask a DJ… control. The reviewers are read here, so the other stages never read them. */
function OnReviewShelf({ rows, laneRow, write, lock }: { rows: IntakeItem[]; laneRow: LaneRow } & AskWrite) {
  const reviewers = useGetReviewersQuery(undefined);
  const { alert, picker, shelfRecordId, shelfAlbumId } = useAskADj({ reviewers, write, lock });
  return (
    <>
      {alert}
      <RowList
        rows={rows}
        row={(i) =>
          laneRow(i, <Typography level="body-sm">{`${REVIEW_COPY.screen.logged} ${day(i.logged_at)}`}</Typography>, picker(i), {
            titleSlot: <Link level="title-md" id={shelfRecordId(i)} href={itemHref(i)}>{i.artist_name}</Link>,
            albumId: shelfAlbumId(i),
          })
        }
      />
    </>
  );
}

/** Filed: the last 30 days, newest first, and the rest from the same read once Show older is pressed. */
function FiledList({ rows, row }: { rows: IntakeItem[]; row: (i: IntakeItem) => ReactNode }) {
  const [all, setAll] = useState(false);
  // The window is fixed when the stage opens, so a list left on screen does not shift under the reader.
  const [now] = useState(() => Date.now());
  const { recent, older } = filedByRecency(rows, now);
  return (
    <>
      <RowList rows={all ? [...recent, ...older] : recent} row={row} />
      {!all && older.length > 0 && (
        <Button variant="plain" onClick={() => setAll(true)}>{COPY.showOlder}</Button>
      )}
    </>
  );
}

function IntakeLaneGroups() {
  const everyState = useGetIntakeItemsQuery(EVERY_STATE, LIVE_LIST);
  const [release] = useReleaseIntakeItemMutation();
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const dispatch = useAppDispatch();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const { write, lock } = useRowWrite<Action>({
    reload: () => [dispatch(intakeApi.endpoints.getIntakeItems.initiate(EVERY_STATE, { subscribe: false, forceRefetch: true }))],
    isLostRace: isIntakeStateChanged,
    onFailure: (err, _id, action) => {
      if (action === "request" && isIntakeRequestRefused(err)) {
        toast.error(COPY.requestRefused);
        void dispatch(reviewApi.endpoints.getReviewers.initiate(undefined, { subscribe: false, forceRefetch: true }));
        return;
      }
      toast.error(REVIEW_COPY.screen.writeFailed);
    },
    onLostRace: (_id, action) => setNotice(RACE_NOTICE[action]),
  });

  // The notice describes the action that lost, so the next action starts without it.
  const act = (id: number, action: Action, run: () => Promise<unknown>) => {
    setNotice(null);
    return write(id, action, run);
  };

  if (hasNothingToShow(everyState)) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }
  // Until the read lands, an empty-state sentence would read as a fact.
  if (!everyState.data) {
    return null;
  }

  const inStage = (stage: ReviewStage) => everyState.data!.filter((i) => recordStage(i) === stage);
  // Being reviewed and Reviewed put the records a DJ has held past the server's overdue line first; the sort is stable.
  const overdueFirst = (rows: IntakeItem[]) => [...rows].sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const rowsOf: Record<ReviewStage, IntakeItem[]> = {
    review_shelf: oldestLoggedFirst(inStage("review_shelf")),
    requested: inStage("requested"),
    being_reviewed: overdueFirst(inStage("being_reviewed")),
    waiting: inStage("waiting"),
    reviewed: overdueFirst(inStage("reviewed")),
    filed: inStage("filed"),
  };
  const passes = everyState.data
    .flatMap((i) => (i.passes ?? []).map((p) => ({ ...p, id: `${i.id}-${p.dj_name}-${p.passed_at}`, item: i })))
    .sort((a, b) => b.passed_at.localeCompare(a.passed_at))
    .slice(0, RECENT_PASSES);

  const cancelButton = (i: IntakeItem) => (
    <Button size="sm" variant="outlined" {...lock(i.id, "cancel")} onClick={() => act(i.id, "cancel", () => cancelRequest(i.id).unwrap())}>
      {COPY.cancelRequest}
    </Button>
  );

  const dialog = confirming && confirmation(confirming);
  // Every stage's row links the artist to the record's page, puts the overdue mark and its lines in `meta`, and ends its actions with Open.
  const laneRow: LaneRow = (i, meta, actions, title) => (
    <RecordRow
      record={intakeRecord(i)}
      cover={56}
      href={itemHref(i)}
      {...title}
      meta={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {i.overdue && <Chip color="danger">{REVIEW_COPY.screen.overdue}</Chip>}
          {meta}
        </Stack>
      }
      actions={
        <>
          {actions}
          <Link href={itemHref(i)}>{COPY.open}</Link>
        </>
      }
    />
  );
  const markReturned = (i: IntakeItem, onClick: () => void) => (
    <Button size="sm" variant="outlined" {...lock(i.id, "return")} onClick={onClick}>
      {COPY.returned}
    </Button>
  );
  const rowFor: Record<Exclude<ReviewStage, "review_shelf">, (i: IntakeItem) => ReactNode> = {
    requested: (i) => laneRow(i, <Typography level="body-sm">{whereLine(i)}</Typography>, cancelButton(i)),
    being_reviewed: (i) =>
      laneRow(
        i,
        <Typography level="body-sm">{whereLine(i)}</Typography>,
        <Button size="sm" variant="outlined" {...lock(i.id, "release")} onClick={() => setConfirming({ item: i, action: "release" })}>
          {REVIEW_COPY.screen.returnToShelf}
        </Button>,
      ),
    waiting: (i) => {
      const returnable = ["checked_out", "removed"].includes(itemHolder(i).kind) && recordKind(i) === "disc";
      return laneRow(
        i,
        <WaitingFrom item={i} where={whereLine(i)} />,
        <>
          {i.effective_state === "requested" && cancelButton(i)}
          {returnable && markReturned(i, () => setConfirming({ item: i, action: "return" }))}
        </>,
      );
    },
    reviewed: (i) => {
      const holder = itemHolder(i);
      const stillOut = holder.kind !== "none" && recordKind(i) === "disc";
      return laneRow(
        i,
        stillOut && (
          <Typography level="body-sm">
            {holder.kind === "removed" ? COPY.holderRemoved : `${COPY.stillOutTo} ${holder.name}`}
          </Typography>
        ),
        stillOut && markReturned(i, () => act(i.id, "return", () => release(i.id).unwrap())),
      );
    },
    filed: (i) => laneRow(i),
  };

  return (
    <Stack spacing={3}>
      {passes.length > 0 && (
        <HeadedSection title={COPY.recentPasses} spacing={1}>
          <List>
            {passes.map((p) => (
              <ListItem key={p.id}>
                {COPY.passedLineDated(
                  COPY.passedLine(p.dj_name, p.item.artist_name, p.item.album_title),
                  formatStationShortDate(p.passed_at),
                )}
              </ListItem>
            ))}
          </List>
        </HeadedSection>
      )}
      {notice && <Typography role="status">{notice}</Typography>}
      <StageChips
        label={COPY.stagesLabel}
        stages={NEW_MUSIC_STAGES.map((id) => ({ id, label: STAGE_LABEL[id], count: rowsOf[id].length }))}
        fallback={rowsOf.waiting.length > 0 ? "waiting" : "being_reviewed"}
      >
        {(stage) => {
          if (stage === "review_shelf") {
            return <OnReviewShelf rows={rowsOf[stage]} laneRow={laneRow} write={act} lock={lock} />;
          }
          return stage === "filed" ? <FiledList rows={rowsOf.filed} row={rowFor.filed} /> : <RowList rows={rowsOf[stage]} row={rowFor[stage]} />;
        }}
      </StageChips>
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={dialog?.title}
        actions={
          <>
            <Button
              onClick={async () => {
                const { item, action } = confirming!;
                setConfirming(null);
                await act(item.id, action, () => release(item.id).unwrap());
              }}
            >
              {dialog?.confirm}
            </Button>
            <Button variant="plain" onClick={() => setConfirming(null)}>{REVIEW_COPY.screen.cancel}</Button>
          </>
        }
      >
        {dialog?.body}
      </ConfirmDialog>
    </Stack>
  );
}
