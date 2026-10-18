"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Box, Button, Chip, Link, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
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
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import StageChips from "../StageChips";
import AddRecordDialog from "./AddRecordDialog";
import FccNotesToConfirm from "./FccNotesToConfirm";
import HeadedSection from "./HeadedSection";
import { REVIEW_COPY } from "./copy";
import RecordRow from "./RecordRow";
import { intakeRecord } from "./recordLine";
import { whereLine, WaitingFrom } from "./ReviewFrom";
import { answerRefusedRequest, useAskADj } from "./useAskADj";
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

/** The music directors' tab: the Add a record button, the FCC notes waiting on them, read on their own, and the intake lanes. */
export default function IntakeLanes() {
  const canSeeReviews = useCanSeeReviews();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The record the dialog last handed off and the moment it did, kept to mark its row on the review shelf stage once;
  // choosing a chip ends the hand-off. The dialog sits here, not in the lanes, so a failed read of the lists does not
  // take away the way to add a record.
  const [handOff, setHandOff] = useState<HandOff | null>(null);
  if (!canSeeReviews) {
    return null;
  }
  const showAdded = (added: IntakeItem) => {
    setHandOff({ id: added.id, at: Date.now() });
    const next = new URLSearchParams(searchParams.toString());
    next.set("stage", "review_shelf");
    window.history.replaceState(null, "", `${pathname}?${next}`);
  };
  return (
    <Stack spacing={3}>
      <AddRecordDialog onDone={showAdded} />
      <FccNotesToConfirm />
      <IntakeLaneGroups handOff={handOff} onStageChosen={() => setHandOff(null)} />
    </Stack>
  );
}

/** A record the Add a record dialog handed off, and the moment it did: one add, so one mark. */
type HandOff = { id: number; at: number };

/**
 * Wraps every row on the review shelf stage, so a row keeps its element when its mark comes and goes. `mark` is set,
 * to its hand-off's key, only on the record just added: the row is highlighted for a moment, and brought into view
 * once when it first appears with that mark, since it sorts last and can be off screen. The fade is CSS, so nothing
 * has to clear the mark.
 */
function AddedMark({ mark, children }: { mark: string | null; children: ReactNode }) {
  // A new callback only for a new mark, so React calls it once per add and not on every render of the list.
  const bringIntoView = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !mark) {
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    },
    [mark],
  );
  return (
    <Box
      ref={bringIntoView}
      data-added={mark ? "true" : undefined}
      sx={{
        width: "100%",
        ...(mark && {
          animation: "recordAddedFade 3s ease-out",
          "@keyframes recordAddedFade": { from: { backgroundColor: "var(--joy-palette-warning-softBg)" } },
        }),
      }}
    >
      {children}
    </Box>
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

/** On the review shelf: each record with the tab's More menu. */
function OnReviewShelf({ rows, laneRow, askADj, handOff }: { rows: IntakeItem[]; laneRow: LaneRow; askADj: ReturnType<typeof useAskADj>; handOff: HandOff | null }) {
  const { alert, moreMenu, shelfRecordId, shelfAlbumId } = askADj;
  const markOf = (i: IntakeItem) => (handOff?.id === i.id ? `${handOff.id}:${handOff.at}` : null);
  return (
    <>
      {alert}
      <RowList
        rows={rows}
        row={(i) => {
          const row = laneRow(i, <Typography level="body-sm">{`${REVIEW_COPY.screen.added} ${day(i.logged_at)}`}</Typography>, moreMenu(i), {
            titleSlot: <Link level="title-md" id={shelfRecordId(i)} href={itemHref(i)}>{i.artist_name}</Link>,
            albumId: shelfAlbumId(i),
          });
          return <AddedMark mark={markOf(i)}>{row}</AddedMark>;
        }}
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

function IntakeLaneGroups({ handOff, onStageChosen }: { handOff: HandOff | null; onStageChosen: () => void }) {
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
      if (answerRefusedRequest(err, action, dispatch)) {
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
  // The Ask a DJ… control lives as long as the tab, as on the Review shelf tab, so a chip switch keeps its Asked toasts.
  // The reviewers are read only while the review shelf stage shows; the opening stage is never that one, so it shows only when `?stage=` names it.
  const onReviewShelf = useSearchParams().get("stage") === "review_shelf";
  const reviewers = useGetReviewersQuery(undefined, { skip: !onReviewShelf });
  const askADj = useAskADj({ reviewers, write: act, lock });

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
            {holder.kind === "removed" ? COPY.stillWithRemoved : `${COPY.stillWith} ${holder.name}`}
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
        onChoose={onStageChosen}
      >
        {(stage) => {
          if (stage === "review_shelf") {
            return <OnReviewShelf rows={rowsOf[stage]} laneRow={laneRow} askADj={askADj} handOff={handOff} />;
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
