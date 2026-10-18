"use client";

import { useState, type ReactNode } from "react";
import { Button, Chip, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import {
  isIntakeStateChanged,
  intakeApi,
  useCancelIntakeRequestMutation,
  useGetIntakeItemsQuery,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { LIVE_LIST } from "@/lib/features/reviews/api";
import { awaitingRecords, itemHolder, recordStage, type ReviewStage } from "@/lib/features/reviews/holder";
import { byKind, recordKind } from "@/lib/features/reviews/kind";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import FccNotesToConfirm from "./FccNotesToConfirm";
import HeadedSection from "./HeadedSection";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import RecordRow from "./RecordRow";
import { intakeRecord } from "./recordLine";
import { placeLine, WaitingFrom } from "./ReviewFrom";
import { formatStationShortDate } from "@/src/utilities/stationTime";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";

const COPY = REVIEW_COPY.intake;

// One argument per read, shared by its hook and the post-write reload so the
// reload reaches the same cache entry. The unfiltered read carries every
// state; the lanes are its rows grouped by `effective_state`.
const EVERY_STATE = undefined;
export const AWAITING_LANE = { awaiting_acceptance: true } as const;

// `release` is Being reviewed's Return to the review shelf; `return` is Mark as returned, on the Reviewed lane and on a
// Review waiting disc. Both call /release.
type Action = "cancel" | "release" | "return";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const RACE_NOTICE: Record<Action, string> = {
  cancel: COPY.raceCancel,
  release: COPY.raceCheckoutReleased,
  return: COPY.raceReleased,
};

const RECENT_PASSES = 5;

/** A confirmation that is open: Return to the review shelf (`release`) or a Review waiting disc's Mark as returned (`return`). */
type Confirming = { item: IntakeItem; action: Exclude<Action, "cancel"> };

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

function IntakeLaneGroups() {
  const everyState = useGetIntakeItemsQuery(EVERY_STATE, LIVE_LIST);
  const awaiting = useGetIntakeItemsQuery(AWAITING_LANE, LIVE_LIST);
  const [release] = useReleaseIntakeItemMutation();
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const dispatch = useAppDispatch();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const { write, lock } = useRowWrite<Action>({
    reload: () =>
      [EVERY_STATE, AWAITING_LANE].map((arg) =>
        dispatch(intakeApi.endpoints.getIntakeItems.initiate(arg, { subscribe: false, forceRefetch: true })),
      ),
    isLostRace: isIntakeStateChanged,
    onFailure: () => toast.error(REVIEW_COPY.screen.writeFailed),
    onLostRace: (_id, action) => setNotice(RACE_NOTICE[action]),
  });

  // The notice describes the action that lost, so the next action starts without it.
  const act = (id: number, action: Action, run: () => Promise<unknown>) => {
    setNotice(null);
    return write(id, action, run);
  };

  if ([everyState, awaiting].some(hasNothingToShow)) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }
  // Until every lane lands, an empty-state sentence would read as a fact.
  if (!everyState.data || !awaiting.data) return null;

  const waitingIds = new Set(awaiting.data.map((i) => i.id));
  const inStage = (stage: ReviewStage) => everyState.data!.filter((i) => recordStage(i, waitingIds) === stage);
  // Both checkout lanes put the records a DJ has held past the server's overdue line first; the sort is stable.
  const overdueFirst = (rows: IntakeItem[]) => [...rows].sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const waitingRows = awaitingRecords(awaiting.data);
  const reviewed = inStage("reviewed");
  const passes = everyState.data
    .flatMap((i) => (i.passes ?? []).map((p) => ({ ...p, id: `${i.id}-${p.dj_name}-${p.passed_at}`, item: i })))
    .sort((a, b) => b.passed_at.localeCompare(a.passed_at))
    .slice(0, RECENT_PASSES);

  const where = (i: IntakeItem) => {
    const holder = itemHolder(i);
    if (holder.kind === "requested") {
      return `${COPY.heldFor} ${holder.name}`;
    }
    if (holder.kind === "checked_out") {
      return `${byKind(i, { disc: COPY.checkedOutTo, digital: COPY.takenBy })} ${holder.name}`;
    }
    if (holder.kind === "removed") {
      return byKind(i, { disc: COPY.holderRemovedNow, digital: COPY.takenByRemoved });
    }
    return placeLine(i);
  };

  const cancelButton = (i: IntakeItem) => (
    <Button size="sm" variant="outlined" {...lock(i.id, "cancel")} onClick={() => act(i.id, "cancel", () => cancelRequest(i.id).unwrap())}>
      {COPY.cancelRequest}
    </Button>
  );

  const dialog = confirming && confirmation(confirming);
  // Every lane's row links the artist to the record's page and puts the overdue mark and its lines in `meta`.
  const laneRow = (i: IntakeItem, meta?: ReactNode, actions?: ReactNode) => (
    <RecordRow
      record={intakeRecord(i)}
      href={`/dashboard/admin/intake/${i.id}`}
      meta={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {i.overdue && <Chip color="danger">{REVIEW_COPY.screen.overdue}</Chip>}
          {meta}
        </Stack>
      }
      actions={actions}
    />
  );

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
      {waitingRows.length > 0 && (
        <IntakeLane
          title={`${COPY.waiting} (${waitingRows.length})`}
          rows={waitingRows}
          empty={COPY.empty}
          row={(i) => {
            const requested = i.effective_state === "requested";
            const returnable = ["checked_out", "removed"].includes(itemHolder(i).kind) && recordKind(i) === "disc";
            return laneRow(
              i,
              <WaitingFrom item={i} where={where(i)} />,
              (requested || returnable) && (
                <>
                  {requested && cancelButton(i)}
                  {returnable && (
                    <Button size="sm" variant="outlined" {...lock(i.id, "return")} onClick={() => setConfirming({ item: i, action: "return" })}>
                      {COPY.returned}
                    </Button>
                  )}
                </>
              ),
            );
          }}
        />
      )}
      <IntakeLane
        title={COPY.requested}
        rows={inStage("requested")}
        empty={COPY.empty}
        row={(i) => laneRow(i, <Typography level="body-sm">{where(i)}</Typography>, cancelButton(i))}
      />
      <IntakeLane
        title={COPY.beingReviewed}
        rows={overdueFirst(inStage("being_reviewed"))}
        empty={COPY.empty}
        row={(i) =>
          laneRow(
            i,
            <Typography level="body-sm">{where(i)}</Typography>,
            !waitingIds.has(i.id) && (
              <Button size="sm" variant="outlined" {...lock(i.id, "release")} onClick={() => setConfirming({ item: i, action: "release" })}>
                {REVIEW_COPY.screen.returnToShelf}
              </Button>
            ),
          )
        }
      />
      <IntakeLane
        title={reviewed.length > 0 ? `${COPY.reviewed} (${reviewed.length})` : COPY.reviewed}
        rows={overdueFirst(reviewed)}
        empty={COPY.empty}
        row={(i) => {
          const holder = itemHolder(i);
          const stillOut = holder.kind !== "none" && recordKind(i) === "disc";
          return laneRow(
            i,
            stillOut && (
              <Typography level="body-sm">
                {holder.kind === "removed" ? COPY.holderRemoved : `${COPY.stillOutTo} ${holder.name}`}
              </Typography>
            ),
            stillOut && (
              <Button size="sm" variant="outlined" {...lock(i.id, "return")} onClick={() => act(i.id, "return", () => release(i.id).unwrap())}>
                {COPY.returned}
              </Button>
            ),
          );
        }}
      />
      <IntakeLane title={COPY.filed} rows={inStage("filed")} empty={COPY.empty} row={(i) => laneRow(i)} />
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
