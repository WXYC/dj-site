"use client";

import { useState } from "react";
import { Button, Chip, Link, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  isIntakeStateChanged,
  intakeApi,
  useCancelIntakeRequestMutation,
  useGetIntakeItemsQuery,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { itemHolder } from "@/lib/features/reviews/holder";
import { byKind, recordKind } from "@/lib/features/reviews/kind";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import FccNotesToConfirm from "./FccNotesToConfirm";
import HeadedSection from "./HeadedSection";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import { intakeRecord, recordLine } from "./recordLine";
import { placeLine, WaitingFrom } from "./ReviewFrom";
import { formatStationShortDate } from "@/src/utilities/stationTime";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";

const COPY = REVIEW_COPY.intake;

// One argument per read, shared by its hook and the post-write reload so the
// reload reaches the same cache entry. The unfiltered read carries every
// state; the lanes are its rows grouped by `effective_state`.
const EVERY_STATE = undefined;
export const AWAITING_LANE = { awaiting_acceptance: true } as const;

// `return` is the Reviewed lane's Mark as returned; both it and `release` call /release.
type Action = "cancel" | "release" | "return";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const RACE_NOTICE: Record<Action, string> = {
  cancel: COPY.raceCancel,
  release: COPY.raceCheckoutReleased,
  return: COPY.raceReleased,
};

const RECENT_PASSES = 5;

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
  const everyState = useGetIntakeItemsQuery(EVERY_STATE);
  const awaiting = useGetIntakeItemsQuery(AWAITING_LANE);
  const { data: formats } = useGetFormatsQuery();
  const [release] = useReleaseIntakeItemMutation();
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const dispatch = useAppDispatch();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ item: IntakeItem; action: "release" | "return" } | null>(null);
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
  const inState = (state: IntakeItem["effective_state"]) => everyState.data!.filter((i) => i.effective_state === state);
  // Both checkout lanes put the records a DJ has held past the server's overdue line first; the sort is stable.
  const overdueFirst = (rows: IntakeItem[]) => [...rows].sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const reviewed = inState("reviewed");
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

  const laneLabel = (i: IntakeItem) => (
    <>
      <Link href={`/dashboard/admin/intake/${i.id}`}>{recordLine(intakeRecord(i), formats)}</Link>
      {i.overdue && <Chip color="danger">{REVIEW_COPY.screen.overdue}</Chip>}
    </>
  );
  const confirmingHolder = confirming && itemHolder(confirming.item);
  const holderName = confirmingHolder && "name" in confirmingHolder ? confirmingHolder.name : null;
  const physical = (i: IntakeItem) => waitingIds.has(i.id) && <Chip size="sm">{COPY.reviewWaitingMark}</Chip>;

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
      {awaiting.data.length > 0 && (
        <IntakeLane
          title={`${COPY.waiting} (${awaiting.data.length})`}
          rows={awaiting.data}
          empty={COPY.empty}
          label={laneLabel}
          extra={(i) => (
            <>
              <WaitingFrom item={i} where={where(i)} />
              {["checked_out", "removed"].includes(itemHolder(i).kind) && recordKind(i) === "disc" && (
                <Button size="sm" variant="outlined" {...lock(i.id, "return")} onClick={() => setConfirming({ item: i, action: "return" })}>
                  {COPY.returned}
                </Button>
              )}
            </>
          )}
        />
      )}
      <IntakeLane
        title={COPY.requested}
        rows={inState("requested")}
        empty={COPY.empty}
        label={laneLabel}
        extra={(i) => (
          <>
            {physical(i)}
            <Typography level="body-sm">{where(i)}</Typography>
            <Button size="sm" variant="outlined" {...lock(i.id, "cancel")} onClick={() => act(i.id, "cancel", () => cancelRequest(i.id).unwrap())}>
              {COPY.cancelRequest}
            </Button>
          </>
        )}
      />
      <IntakeLane
        title={COPY.beingReviewed}
        rows={overdueFirst(inState("checked_out"))}
        empty={COPY.empty}
        label={laneLabel}
        extra={(i) => (
          <>
            {physical(i)}
            <Typography level="body-sm">{where(i)}</Typography>
            {!waitingIds.has(i.id) && (
              <Button size="sm" variant="outlined" {...lock(i.id, "release")} onClick={() => setConfirming({ item: i, action: "release" })}>
                {REVIEW_COPY.screen.returnToShelf}
              </Button>
            )}
          </>
        )}
      />
      <IntakeLane
        title={reviewed.length > 0 ? `${COPY.reviewed} (${reviewed.length})` : COPY.reviewed}
        rows={overdueFirst(reviewed)}
        empty={COPY.empty}
        label={laneLabel}
        extra={(i) => {
          const holder = itemHolder(i);
          return (
            holder.kind !== "none" &&
            recordKind(i) === "disc" && (
              <>
                <Typography level="body-sm">
                  {holder.kind === "removed" ? COPY.holderRemoved : `${COPY.stillOutTo} ${holder.name}`}
                </Typography>
                <Button size="sm" variant="outlined" {...lock(i.id, "return")} onClick={() => act(i.id, "return", () => release(i.id).unwrap())}>
                  {COPY.returned}
                </Button>
              </>
            )
          );
        }}
      />
      <IntakeLane title={COPY.filed} rows={inState("filed")} empty={COPY.empty} label={laneLabel} />
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming?.action === "return"
          ? COPY.markReturnedQuestion(confirming.item.artist_name, confirming.item.album_title)
          : confirming && COPY.returnQuestion(confirming.item.artist_name, confirming.item.album_title)}
        actions={
          <>
            <Button
              onClick={async () => {
                const { item, action } = confirming!;
                setConfirming(null);
                await act(item.id, action, () => release(item.id).unwrap());
              }}
            >
              {confirming?.action === "return" ? COPY.returned : REVIEW_COPY.screen.returnToShelf}
            </Button>
            <Button variant="plain" onClick={() => setConfirming(null)}>{REVIEW_COPY.screen.cancel}</Button>
          </>
        }
      >
        {confirming?.action === "return"
          ? COPY.markReturnedBody(holderName)
          : confirming && `${COPY.returnBody(holderName)}${holderName && recordKind(confirming.item) === "disc" ? ` ${COPY.returnBringDisc}` : ""}`}
      </ConfirmDialog>
    </Stack>
  );
}
