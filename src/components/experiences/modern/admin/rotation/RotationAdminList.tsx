"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { addThenRetire } from "@/lib/features/rotation/addThenRetire";
import {
  canMoveRotationRow,
  freeTextRotationMoveRequest,
  rotationMoveRetireIds,
  selectRotationAdminView,
  rotationRowCode,
  rotationRowPresentation,
} from "@/lib/features/rotation/adminList";
import { groupRotationCardsByBin } from "@/lib/features/rotation/cards";
import {
  useAddFreeTextRotationEntryMutation,
  useAddRotationEntryMutation,
  useGetRotationCardsQuery,
  useGetRotationListQuery,
  useKillRotationEntryMutation,
  useLazyGetRotationRowQuery,
} from "@/lib/features/rotation/api";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { useRotationRowActions } from "@/lib/features/rotation/hooks";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationListRow,
  type RotationRowSummary,
} from "@/lib/features/rotation/types";
import { useAppDispatch } from "@/lib/hooks";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";
import { Link as LinkIcon } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Input,
  LinearProgress,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import type { RotationCard } from "@wxyc/shared";

function FilterChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <Chip
      size="sm"
      variant={selected ? "solid" : "outlined"}
      color={selected ? "primary" : "neutral"}
      onClick={onClick}
      slotProps={{ action: { "aria-pressed": selected } }}
    >
      {label}
    </Chip>
  );
}

/** The card as row text: the select control replaces this on rows that can move. */
function cardText(card: RotationCard | null | undefined): string {
  if (!card) return "no card";
  return card.name ? `card ${card.number} — ${card.name}` : `card ${card.number}`;
}

/**
 * One rotation row. Unlinked rows (`id: null` — a release never catalogued)
 * carry only their snapshot fields: the shelf code is absent by construction
 * and every action here names the row by `rotation_id`, never a library
 * record.
 */
function RotationAdminRow({
  row,
  binCards,
  pending,
  moveLocked,
  onKill,
  onUnkill,
  onSelectCard,
  onMoveBin,
}: {
  row: RotationListRow;
  /** The row's own bin's cards — the card select is a within-bin move only. */
  binCards: RotationCard[];
  pending: boolean;
  /** Disables the cross-bin move chips beyond this row's own pending state. */
  moveLocked: boolean;
  onKill: () => void;
  onUnkill: () => void;
  onSelectCard: (cardId: number) => void;
  onMoveBin: (bin: RotationBin) => void;
}): JSX.Element {
  const killed = rotationRowPresentation(row) === "killed";
  const code = rotationRowCode(row);
  const urls = row.urls ?? [];
  // Named per row: a list of identical "Kill" buttons tells a screen-reader
  // user nothing about which release they are about to act on.
  const name = row.album_title ?? row.artist_name ?? `rotation ${row.rotation_id}`;

  return (
    <Sheet
      variant="outlined"
      data-testid={`rotation-admin-row-${row.rotation_id}`}
      sx={{ borderRadius: "md", px: 1.5, py: 1, opacity: killed ? 0.65 : 1 }}
    >
      <Typography level="body-sm">
        <Typography fontWeight="lg">{row.artist_name ?? ""}</Typography>
        {" — "}
        <Typography>{row.album_title ?? ""}</Typography>
        {code != null && (
          <Typography color="primary" fontWeight="lg" fontSize="xs" sx={{ ml: 0.75 }}>
            {code}
          </Typography>
        )}
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mt: 0.75, flexWrap: "wrap" }}>
        {killed || !canMoveRotationRow(row) ? (
          <Chip size="sm" variant="soft" title={ROTATION_BIN_LABELS[row.rotation_bin]}>
            {row.rotation_bin}
          </Chip>
        ) : (
          <Stack direction="row" spacing={0.5}>
            {ROTATION_BINS.map((bin) =>
              bin === row.rotation_bin ? (
                <Chip key={bin} size="sm" variant="solid" color="primary" title={ROTATION_BIN_LABELS[bin]}>
                  {bin}
                </Chip>
              ) : (
                <Chip
                  key={bin}
                  size="sm"
                  variant="outlined"
                  disabled={pending || moveLocked}
                  onClick={() => onMoveBin(bin)}
                  slotProps={{
                    action: {
                      "aria-label": `Move to ${ROTATION_BIN_LABELS[bin]}: ${name}`,
                      // Joy points the action at the chip's one-letter label
                      // by default, and labelledby would out-rank the label
                      // above in accessible-name computation.
                      "aria-labelledby": undefined,
                    },
                  }}
                >
                  {bin}
                </Chip>
              ),
            )}
          </Stack>
        )}
        {killed || binCards.length === 0 ? (
          row.card ? (
            // Badge is decorative; `title` keeps the full "card N — name"
            // reading in the accessible tree.
            <Typography level="body-xs" title={cardText(row.card)}>
              <RotationCardBadge number={row.card.number} />
              {row.card.name}
            </Typography>
          ) : (
            <Typography level="body-xs">no card</Typography>
          )
        ) : (
          <Select
            size="sm"
            value={row.card?.id ?? null}
            placeholder="no card"
            disabled={pending}
            onChange={(_event, cardId) => {
              if (cardId != null && cardId !== row.card?.id) onSelectCard(cardId);
            }}
            slotProps={{ button: { "aria-label": `Card for: ${name}` } }}
            sx={{ minWidth: 140 }}
            // The badge is aria-hidden, so an option's visible content is only
            // the optional name — `aria-label` restores the full "card N — name"
            // as the accessible name (it would otherwise be empty for an unnamed
            // card), and `label` carries the same for typeahead.
            renderValue={(selected) => {
              if (!selected) return null;
              const card = binCards.find((c) => c.id === selected.value);
              if (!card) return selected.label;
              return (
                <>
                  <RotationCardBadge number={card.number} />
                  {card.name}
                </>
              );
            }}
          >
            {binCards.map((card) => (
              <Option
                key={card.id}
                value={card.id}
                label={cardText(card)}
                aria-label={cardText(card)}
              >
                <RotationCardBadge number={card.number} />
                {card.name}
              </Option>
            ))}
          </Select>
        )}
        {urls.length > 0 && (
          // A count with the values in the tooltip, never an anchor: the wire
          // contract's own warning — MDs paste bare domains, so a value
          // carries no scheme guarantee and must not be bound into an href
          // unchecked.
          <Typography
            level="body-xs"
            startDecorator={<LinkIcon fontSize="inherit" />}
            title={urls.join("\n")}
          >
            {urls.length}
          </Typography>
        )}
        <Typography level="body-xs">added {formatRotationDate(row.rotation_add_date)}</Typography>
        {killed && (
          <Typography level="body-xs" color="danger">
            killed {formatRotationDate(row.rotation_kill_date)}
          </Typography>
        )}
        <Box sx={{ ml: "auto" }}>
          {killed ? (
            <Button
              variant="plain"
              size="sm"
              disabled={pending}
              aria-label={`Unkill: ${name}`}
              onClick={onUnkill}
            >
              Unkill
            </Button>
          ) : (
            <Button
              variant="plain"
              color="danger"
              size="sm"
              disabled={pending}
              aria-label={`Kill: ${name}`}
              onClick={onKill}
            >
              Kill
            </Button>
          )}
        </Box>
      </Stack>
    </Sheet>
  );
}

/**
 * How many killed rows mount per batch. The `status=all` read is unbounded
 * and its killed presentation is the station's whole rotation history —
 * thousands of rows in production — so mounting a Joy row per entry at once
 * is the one unbounded render on this screen. A render cap only: search,
 * filters, and every count still run over the full set, and the active
 * section stays uncapped (bounded in practice by what's in rotation).
 */
const KILLED_RENDER_BATCH = 50;

type RowActions = {
  cardsByBin: ReadonlyMap<RotationBin, RotationCard[]>;
  pendingRotationIds: ReadonlySet<number>;
  moveLocked: boolean;
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  onSelectCard: (rotationId: number, cardId: number) => void;
  onMoveBin: (row: RotationListRow, bin: RotationBin) => void;
};

function RowSection({
  title,
  testId,
  count,
  rows,
  actions,
}: {
  title: string;
  testId: string;
  count: string;
  rows: RotationListRow[];
  actions: RowActions;
}): JSX.Element {
  return (
    <Box data-testid={testId}>
      <Typography
        component="h3"
        level="title-sm"
        textColor="text.tertiary"
        sx={{ textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}
      >
        {title} ({count})
      </Typography>
      {rows.length === 0 ? (
        <Typography level="body-sm" textColor="text.tertiary">
          No {title.toLowerCase()} rotation entries match this filter.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rows.map((row) => (
            <RotationAdminRow
              key={row.rotation_id}
              row={row}
              binCards={actions.cardsByBin.get(row.rotation_bin) ?? []}
              pending={actions.pendingRotationIds.has(row.rotation_id)}
              moveLocked={actions.moveLocked}
              onKill={() => actions.onKill(row.rotation_id)}
              onUnkill={() => actions.onUnkill(row.rotation_id)}
              onSelectCard={(cardId) => actions.onSelectCard(row.rotation_id, cardId)}
              onMoveBin={(bin) => actions.onMoveBin(row, bin)}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

/**
 * The Rotation Admin management list: every rotation row — the `status=all`
 * read is the one read that can show killed rows at all — filtered by a
 * search box, bin chips, and (once a single bin is chosen) that bin's card
 * chips, split into Active and Killed presentations.
 *
 * cache sync lives on the endpoints and this list adds no cache handling of
 * its own — the endpoints patch the row in the cached `status=all` read, so
 * a row changes presentation without refetching the full rotation history.
 * The per-row card select is that same field editor carrying `card_id`, a
 * within-bin move only; the bin chips beside it are the cross-bin move —
 * add-then-kill through the shared `addThenRetire` ordering, because no
 * endpoint edits a bin in place.
 */
export default function RotationAdminList(): JSX.Element {
  const { data: rows, isFetching, isError, refetch } = useGetRotationListQuery("all");
  // The card sub-filter's vocabulary. A failed cards read must not impair the
  // list itself: the rows still render (each knows its own card), only the
  // sub-filter stays hidden until a retryable refetch succeeds.
  const { data: cards } = useGetRotationCardsQuery();

  // Kill, Unkill, the within-bin card move, and the shared in-flight set come
  // from the one owner both list surfaces share. The cross-bin move stays
  // this list's own (no other surface files a bin move), but it registers in
  // that same in-flight set through the hook's `withPending` so a row shows
  // pending for a move exactly as it does for a kill.
  const { pendingRotationIds, kill, unkill, moveToCard, withPending } = useRotationRowActions();
  const dispatch = useAppDispatch();
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [addRotationEntry] = useAddRotationEntryMutation();
  const [addFreeTextRotationEntry] = useAddFreeTextRotationEntryMutation();
  const [fetchRotationRow] = useLazyGetRotationRowQuery();

  const [search, setSearch] = useState("");
  const [bin, setBin] = useState<RotationBin | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [killedRenderCap, setKilledRenderCap] = useState(KILLED_RENDER_BATCH);

  const view = useMemo(
    () => selectRotationAdminView(rows ?? [], { search, bin, cardId }),
    [rows, search, bin, cardId],
  );
  const cardsByBin = useMemo(() => groupRotationCardsByBin(cards ?? []), [cards]);
  const binCards = bin == null ? [] : (cardsByBin.get(bin) ?? []);

  // The cross-bin move: add-then-kill through the shared ordering, since no
  // endpoint edits a bin in place. The add carries no card_id — the server
  // files an omitted card on the target bin's newest, exactly where a move
  // lands — but it carries everything else the source row holds (`urls`,
  // and an unlinked row's pre-catalog fields), because the kill half
  // retires the only row that holds them. The `urls` carry is stored only
  // by a Backend that admits the key on the add; an older
  // backend's allowlist drops it silently, which is harmless. It goes
  // through the same mutations the classify gesture drives, never a
  // hand-rolled orchestration that could reverse the halves.
  const moveRow = async (row: RotationListRow, targetBin: RotationBin) => {
    let add: (() => Promise<unknown>) | null = null;
    if (row.id != null) {
      const albumId = row.id;
      add = () =>
        addRotationEntry({
          album_id: albumId,
          rotation_bin: targetBin,
          ...(row.urls?.length ? { urls: row.urls } : {}),
        }).unwrap();
    } else {
      // The list read's `label_id`/`format_name` are the library join's —
      // null by construction on an unlinked row — so the row's own
      // pre-catalog `format_id`/`label_id` are only readable from the
      // single-row read. The read exists here to feed the write, so it
      // fails closed (the write-precondition contract): proceeding without
      // it would re-file the release with those fields silently dropped,
      // exactly the loss the fetch is for.
      let detail: RotationRowSummary;
      try {
        detail = await fetchRotationRow(row.rotation_id).unwrap();
      } catch {
        toast.error(
          `Couldn't move this release to ${ROTATION_BIN_LABELS[targetBin]} — nothing changed.`,
        );
        return;
      }
      const freeTextRequest = freeTextRotationMoveRequest(row, targetBin, detail);
      if (freeTextRequest != null) {
        add = () => addFreeTextRotationEntry(freeTextRequest).unwrap();
      }
    }
    // Unreachable behind the chips' own canMoveRotationRow gate; a bare kill
    // here would be a move that loses the record, so refuse instead.
    if (add == null) return;

    try {
      const outcome = await addThenRetire(
        add,
        rotationMoveRetireIds(rows ?? [], row, targetBin),
        (rotationId) => killRotationEntry({ rotation_id: rotationId }).unwrap(),
      );

      if (outcome.step === "add-failed") {
        // The free-text add's refusals are wrapped out of the middleware toast
        // (so the server's own sentence lands here); the catalogued add's
        // reach it, and only the shapes it stays silent about are this row's.
        if (isUnmessagedHttpError(outcome.error)) {
          toast.error(
            rotationWriteErrorMessage(
              outcome.error,
              `Couldn't move this release to ${ROTATION_BIN_LABELS[targetBin]} — nothing changed.`,
            ),
          );
        }
        return;
      }
      if (outcome.retireFailures.length === 0) {
        toast.success(`Moved to ${ROTATION_BIN_LABELS[targetBin]} rotation.`);
        return;
      }
      if (outcome.retireFailures.some(({ error }) => isUnmessagedHttpError(error))) {
        // Naming the state that resulted: the release is filed in more bins
        // than intended — visible in this list, recoverable with each
        // leftover row's own Kill. Named singular only when the one failed
        // retire is the moved row itself; a failed target-bin duplicate
        // retire is not "the <source bin> entry".
        const single =
          outcome.retireFailures.length === 1 &&
          outcome.retireFailures[0].rotationId === row.rotation_id;
        toast.error(
          single
            ? `Filed in ${ROTATION_BIN_LABELS[targetBin]}, but couldn't retire the ${ROTATION_BIN_LABELS[row.rotation_bin]} entry — kill it from this list.`
            : `Filed in ${ROTATION_BIN_LABELS[targetBin]}, but couldn't retire every prior entry — kill them from this list.`,
        );
      }
    } finally {
      // The add's cache handler wrote a per-album rotation claim into the
      // catalog slice; inside this gesture it stops the kill half from
      // clearing the bin the add just recorded, but outside it the claim is
      // a guess about the server with no expiry — left in place it survives
      // the tab, and once another surface replaces the entry out of band a
      // later kill of the real entry no longer matches it and skips the
      // catalog clear. Its lifetime is bounded to the gesture, exactly as
      // `useAlbumRotationActions.setRotation` bounds it.
      if (row.id != null) {
        dispatch(catalogSlice.actions.clearAlbumRotation(row.id));
      }
    }
  };

  const actions: RowActions = {
    cardsByBin,
    pendingRotationIds,
    // The move chips stay disabled while the list refetches: the add half
    // invalidates the rotation list, and every row keeps rendering its old
    // bin until that refetch lands — a second click in that window would
    // file a second active entry for the same release, which the backend's
    // bare insert accepts.
    moveLocked: isFetching,
    onKill: (rotationId) => void kill(rotationId),
    onUnkill: (rotationId) => void unkill(rotationId),
    onSelectCard: (rotationId, nextCardId) => void moveToCard(rotationId, nextCardId),
    // `moveRow` settles every failure into its own toast; `withPending`'s
    // catch stays as the backstop for a shape it never expects to see, and
    // registers the row in the shared in-flight set for the move's duration.
    onMoveBin: (row, bin) => void withPending(row.rotation_id, () => moveRow(row, bin), "move"),
  };

  // Absence-of-list, not the error flag: a background refetch can leave
  // isError true while the last-good rows are still on screen, and a
  // query-fed list must never render an outage as "there are none".
  if (isError && rows == null) {
    return (
      <Alert color="danger" sx={{ justifyContent: "space-between" }}>
        <Typography>Could not load the rotation list.</Typography>
        <Button
          variant="outlined"
          color="danger"
          size="sm"
          loading={isFetching}
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </Alert>
    );
  }
  if (rows == null) return <LinearProgress aria-label="Loading rotation" />;

  const selectBin = (next: RotationBin | null) => {
    // The card filter names a card of the outgoing bin; it cannot survive.
    setCardId(null);
    setBin(next);
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Input
          size="sm"
          type="search"
          placeholder="Search artist, title, or code…"
          aria-label="Search rotation"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ width: 280 }}
        />
        <FilterChip
          selected={bin === null}
          label={`All (${view.searchedActiveCount})`}
          onClick={() => selectBin(null)}
        />
        {ROTATION_BINS.map((candidate) => (
          <FilterChip
            key={candidate}
            selected={bin === candidate}
            label={`${candidate} (${view.binCounts.get(candidate) ?? 0})`}
            onClick={() => selectBin(bin === candidate ? null : candidate)}
          />
        ))}
      </Stack>

      {bin != null && binCards.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <FilterChip selected={cardId === null} label="All cards" onClick={() => setCardId(null)} />
          {binCards.map((card) => (
            <FilterChip
              key={card.id}
              selected={cardId === card.id}
              label={`${cardText(card)} (${view.cardCounts.get(card.id) ?? 0})`}
              onClick={() => setCardId(cardId === card.id ? null : card.id)}
            />
          ))}
        </Stack>
      )}

      <RowSection
        title="Active"
        testId="rotation-admin-active"
        count={view.narrowed ? `${view.active.length} of ${view.activeTotal}` : `${view.activeTotal}`}
        rows={view.active}
        actions={actions}
      />
      <RowSection
        title="Killed"
        testId="rotation-admin-killed"
        count={view.narrowed ? `${view.killed.length} of ${view.killedTotal}` : `${view.killedTotal}`}
        rows={view.killed.slice(0, killedRenderCap)}
        actions={actions}
      />
      {view.killed.length > killedRenderCap && (
        <Button
          variant="outlined"
          color="neutral"
          size="sm"
          sx={{ alignSelf: "center" }}
          onClick={() => setKilledRenderCap((cap) => cap + KILLED_RENDER_BATCH)}
        >
          Show {Math.min(KILLED_RENDER_BATCH, view.killed.length - killedRenderCap)} more
        </Button>
      )}
    </Stack>
  );
}
