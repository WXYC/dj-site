"use client";

import { useState } from "react";
import { Button, Chip, FormControl, FormLabel, Input, Link, List, ListItem, Option, Select, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  isIntakeStateChanged,
  reviewsApi,
  useGetIntakeItemsQuery,
  useLogIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/api";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import LabelSearchTypeahead from "../catalog/AddRelease/LabelSearchTypeahead";
import { REVIEW_COPY } from "./copy";
import { intakeRecord, recordLine } from "./recordLine";

const COPY = REVIEW_COPY.intake;

// One argument per lane, shared by its hook and the post-write reload so the
// reload reaches the same cache entry.
const OPEN_LANES = undefined;
const AWAITING_LANE = { awaiting_acceptance: true } as const;
const REVIEWED_LANE = { state: "reviewed" } as const;
const FILED_LANE = { state: "filed" } as const;

const EMPTY_FORM = { artist: "", album: "", label: "", labelId: null as number | null, formatId: null as number | null, discogs: "" };

export default function IntakeScreen() {
  const visible = useCanSeeReviews();
  const open = useGetIntakeItemsQuery(OPEN_LANES, { skip: !visible });
  const awaiting = useGetIntakeItemsQuery(AWAITING_LANE, { skip: !visible });
  const reviewed = useGetIntakeItemsQuery(REVIEWED_LANE, { skip: !visible });
  const filed = useGetIntakeItemsQuery(FILED_LANE, { skip: !visible });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !visible });
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const dispatch = useAppDispatch();
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const { write, lock } = useRowWrite<"release">({
    reload: () =>
      [OPEN_LANES, AWAITING_LANE, REVIEWED_LANE, FILED_LANE].map((arg) =>
        dispatch(reviewsApi.endpoints.getIntakeItems.initiate(arg, { subscribe: false, forceRefetch: true })),
      ),
    isLostRace: isIntakeStateChanged,
    onFailure: () => toast.error(REVIEW_COPY.screen.writeFailed),
    onLostRace: () => setNotice(COPY.raceReleased),
  });

  if (!visible) return null;
  if (open.isError || awaiting.isError || reviewed.isError || filed.isError) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }
  // Until every lane lands, an empty-state sentence would read as a fact.
  if (!open.data || !awaiting.data || !reviewed.data || !filed.data) return null;

  const waitingIds = new Set(awaiting.data.map((i) => i.id));
  const inState = (state: IntakeItem["effective_state"]) => open.data!.filter((i) => i.effective_state === state);

  const submit = async () => {
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
        : `${COPY.checkedOutTo} ${i.checked_out_by_name}`;

  const lane = (title: string, rows: IntakeItem[], extra?: (i: IntakeItem) => React.ReactNode) => (
    <section aria-label={title} key={title}>
      <Typography level="title-lg">{title}</Typography>
      {rows.length === 0 ? (
        <Typography level="body-sm">{COPY.empty}</Typography>
      ) : (
        <List>
          {rows.map((i) => (
            <ListItem key={i.id}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Link href={`/dashboard/admin/intake/${i.id}`}>{recordLine(intakeRecord(i), formats)}</Link>
                {i.overdue && <Chip color="danger">{REVIEW_COPY.screen.overdue}</Chip>}
                {extra?.(i)}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </section>
  );

  const physical = (i: IntakeItem) => waitingIds.has(i.id) && <Chip size="sm">{COPY.reviewWaitingMark}</Chip>;
  const reviewCount = (n: number) => `${n} ${n === 1 ? "review" : "reviews"}`;

  return (
    <Stack spacing={3}>
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
      {awaiting.data.length > 0 &&
        lane(`${COPY.waiting} (${awaiting.data.length})`, awaiting.data, (i) => (
          <>
            <Typography level="body-sm">{where(i)}</Typography>
            <Typography level="body-sm">{reviewCount(i.submitted_review_count)}</Typography>
          </>
        ))}
      {lane(COPY.onShelf, inState("pool"), physical)}
      {lane(COPY.requested, inState("requested"), physical)}
      {lane(COPY.checkedOut, inState("checked_out"), physical)}
      {lane(COPY.reviewed, reviewed.data, (i) =>
        i.checked_out_at && (
          <>
            <Typography level="body-sm">
              {i.checked_out_by ? `${COPY.stillOutTo} ${i.checked_out_by_name}` : COPY.holderRemoved}
            </Typography>
            <Button size="sm" variant="outlined" {...lock(i.id, "release")} onClick={() => write(i.id, "release", () => release(i.id).unwrap())}>
              {COPY.returned}
            </Button>
          </>
        ),
      )}
      {lane(COPY.filed, filed.data)}
    </Stack>
  );
}
