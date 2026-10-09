"use client";

import { useState } from "react";
import { Button, Chip, FormControl, FormLabel, Input, Link, List, ListItem, Option, Select, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  isIntakeStateChanged,
  intakeApi,
  useCancelIntakeRequestMutation,
  useGetIntakeItemsQuery,
  useLogIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import LabelSearchTypeahead from "../catalog/AddRelease/LabelSearchTypeahead";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import { intakeRecord, recordLine } from "./recordLine";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";

const COPY = REVIEW_COPY.intake;

// One argument per read, shared by its hook and the post-write reload so the
// reload reaches the same cache entry. The unfiltered read carries every
// state; the lanes are its rows grouped by `effective_state`.
const EVERY_STATE = undefined;
const AWAITING_LANE = { awaiting_acceptance: true } as const;

// `return` is the Reviewed lane's Mark as returned; both it and `release` call /release.
type Action = "cancel" | "release" | "return";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const RACE_NOTICE: Record<Action, string> = {
  cancel: COPY.raceCancel,
  release: COPY.raceCheckoutReleased,
  return: COPY.raceReleased,
};

const RECENT_PASSES = 5;

const EMPTY_FORM = { artist: "", album: "", label: "", labelId: null as number | null, formatId: null as number | null, discogs: "" };

export default function IntakeScreen() {
  const visible = useCanSeeReviews();
  const everyState = useGetIntakeItemsQuery(EVERY_STATE, { skip: !visible });
  const awaiting = useGetIntakeItemsQuery(AWAITING_LANE, { skip: !visible });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !visible });
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const dispatch = useAppDispatch();
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
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

  if (!visible) return null;
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

  const submit = async () => {
    setNotice(null);
    try {
      await logItem({
        artist_name: form.artist,
        album_title: form.album,
        format_id: form.formatId!,
        ...(form.label && { record_label: form.label }),
        ...(form.labelId != null && { label_id: form.labelId }),
        ...(form.discogs && { discogs_release_id: Number(form.discogs) }),
      }).unwrap();
      setForm(EMPTY_FORM);
    } catch {
      toast.error(REVIEW_COPY.screen.writeFailed);
    }
  };

  const where = (i: IntakeItem) =>
    i.effective_state === "pool"
      ? COPY.onShelf
      : i.effective_state === "requested"
        ? `${COPY.heldFor} ${i.requested_dj_name}`
        : i.checked_out_by_name
          ? `${COPY.checkedOutTo} ${i.checked_out_by_name}`
          : COPY.holderRemovedNow;

  const laneLabel = (i: IntakeItem) => (
    <>
      <Link href={`/dashboard/admin/intake/${i.id}`}>{recordLine(intakeRecord(i), formats)}</Link>
      {i.overdue && <Chip color="danger">{REVIEW_COPY.screen.overdue}</Chip>}
    </>
  );
  const physical = (i: IntakeItem) => waitingIds.has(i.id) && <Chip size="sm">{COPY.reviewWaitingMark}</Chip>;
  const reviewCount = (n: number) => `${n} ${n === 1 ? COPY.reviewOne : COPY.reviewMany}`;

  return (
    <Stack spacing={3}>
      {passes.length > 0 && (
        <section aria-label={COPY.recentPasses}>
          <List>
            {passes.map((p) => (
              <ListItem key={p.id}>
                {COPY.passedLine(p.dj_name, p.item.artist_name, p.item.album_title)}
              </ListItem>
            ))}
          </List>
        </section>
      )}
      <form
        aria-label={COPY.logTitle}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Typography level="title-lg">{COPY.logTitle}</Typography>
        <Stack spacing={1}>
          <FormControl required>
            <FormLabel>{COPY.artist}</FormLabel>
            <Input value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} />
          </FormControl>
          <FormControl required>
            <FormLabel>{COPY.album}</FormLabel>
            <Input value={form.album} onChange={(e) => setForm((f) => ({ ...f, album: e.target.value }))} />
          </FormControl>
          <FormControl>
            <FormLabel>{COPY.label}</FormLabel>
            <LabelSearchTypeahead
              value={form.label}
              onChange={(label) => setForm((f) => ({ ...f, label }))}
              onSelect={(l) => setForm((f) => ({ ...f, labelId: l.id }))}
              onSelectionCleared={() => setForm((f) => ({ ...f, labelId: null }))}
            />
          </FormControl>
          <FormControl required>
            <FormLabel>{COPY.format}</FormLabel>
            <Select value={form.formatId} onChange={(_e, formatId) => setForm((f) => ({ ...f, formatId }))}>
              {(formats ?? []).map((f) => (
                <Option key={f.id} value={f.id}>{f.format_name}</Option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>{COPY.discogsReleaseId}</FormLabel>
            <Input type="number" value={form.discogs} onChange={(e) => setForm((f) => ({ ...f, discogs: e.target.value }))} />
          </FormControl>
          <Button type="submit" loading={logging} disabled={!form.artist || !form.album || form.formatId == null}>{COPY.log}</Button>
        </Stack>
      </form>
      {notice && <Typography role="status">{notice}</Typography>}
      {awaiting.data.length > 0 && (
        <IntakeLane
          title={`${COPY.waiting} (${awaiting.data.length})`}
          rows={awaiting.data}
          empty={COPY.empty}
          label={laneLabel}
          extra={(i) => (
            <>
              <Typography level="body-sm">{where(i)}</Typography>
              <Typography level="body-sm">{reviewCount(i.submitted_review_count)}</Typography>
            </>
          )}
        />
      )}
      <IntakeLane title={COPY.onShelf} rows={inState("pool")} empty={COPY.empty} label={laneLabel} extra={physical} />
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
        title={COPY.checkedOut}
        rows={overdueFirst(inState("checked_out"))}
        empty={COPY.empty}
        label={laneLabel}
        extra={(i) => (
          <>
            {physical(i)}
            <Typography level="body-sm">{where(i)}</Typography>
            <Button size="sm" variant="outlined" {...lock(i.id, "release")} onClick={() => act(i.id, "release", () => release(i.id).unwrap())}>
              {COPY.release}
            </Button>
          </>
        )}
      />
      <IntakeLane
        title={reviewed.length > 0 ? `${COPY.reviewed} (${reviewed.length})` : COPY.reviewed}
        rows={overdueFirst(reviewed)}
        empty={COPY.empty}
        label={laneLabel}
        extra={(i) =>
          i.checked_out_at && (
            <>
              <Typography level="body-sm">
                {i.checked_out_by ? `${COPY.stillOutTo} ${i.checked_out_by_name}` : COPY.holderRemoved}
              </Typography>
              <Button size="sm" variant="outlined" {...lock(i.id, "return")} onClick={() => act(i.id, "return", () => release(i.id).unwrap())}>
                {COPY.returned}
              </Button>
            </>
          )
        }
      />
      <IntakeLane title={COPY.filed} rows={inState("filed")} empty={COPY.empty} label={laneLabel} />
    </Stack>
  );
}
