"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import {
  selectRotationAdminView,
  rotationRowCode,
  rotationRowPresentation,
} from "@/lib/features/rotation/adminList";
import {
  useGetRotationCardsQuery,
  useGetRotationListQuery,
} from "@/lib/features/rotation/api";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { useRotationRowActions } from "@/lib/features/rotation/hooks";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationListRow,
} from "@/lib/features/rotation/types";
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
  onKill,
  onUnkill,
  onSelectCard,
}: {
  row: RotationListRow;
  /** The row's own bin's cards — the card select is a within-bin move only. */
  binCards: RotationCard[];
  pending: boolean;
  onKill: () => void;
  onUnkill: () => void;
  onSelectCard: (cardId: number) => void;
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
        <Chip size="sm" variant="soft" title={ROTATION_BIN_LABELS[row.rotation_bin]}>
          {row.rotation_bin}
        </Chip>
        {killed || binCards.length === 0 ? (
          <Typography level="body-xs">{cardText(row.card)}</Typography>
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
          >
            {binCards.map((card) => (
              <Option key={card.id} value={card.id}>
                {cardText(card)}
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

type RowActions = {
  cardsByBin: ReadonlyMap<RotationBin, RotationCard[]>;
  pendingRotationIds: ReadonlySet<number>;
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  onSelectCard: (rotationId: number, cardId: number) => void;
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
              onKill={() => actions.onKill(row.rotation_id)}
              onUnkill={() => actions.onUnkill(row.rotation_id)}
              onSelectCard={(cardId) => actions.onSelectCard(row.rotation_id, cardId)}
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
 * Kill and Unkill reuse the rotation feature's existing mutations
 * (`killRotationEntry`; `updateRotationRow` with `kill_date: null`): their
 * cache sync lives on the endpoints and this list adds no cache handling of
 * its own — the endpoints patch the row in the cached `status=all` read, so
 * a row changes presentation without refetching the full rotation history.
 * The per-row card select is that same field editor carrying `card_id`, a
 * within-bin move only.
 */
export default function RotationAdminList(): JSX.Element {
  const { data: rows, isFetching, isError, refetch } = useGetRotationListQuery("all");
  // The card sub-filter's vocabulary. A failed cards read must not impair the
  // list itself: the rows still render (each knows its own card), only the
  // sub-filter stays hidden until a retryable refetch succeeds.
  const { data: cards } = useGetRotationCardsQuery();

  const { pendingRotationIds, kill, unkill, moveToCard } = useRotationRowActions();

  const [search, setSearch] = useState("");
  const [bin, setBin] = useState<RotationBin | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);

  const view = useMemo(
    () => selectRotationAdminView(rows ?? [], { search, bin, cardId }),
    [rows, search, bin, cardId],
  );
  const cardsByBin = useMemo(() => {
    const byBin = new Map<RotationBin, RotationCard[]>();
    for (const card of cards ?? []) {
      const list = byBin.get(card.bin) ?? [];
      list.push(card);
      byBin.set(card.bin, list);
    }
    for (const list of byBin.values()) list.sort((left, right) => left.number - right.number);
    return byBin;
  }, [cards]);
  const binCards = bin == null ? [] : (cardsByBin.get(bin) ?? []);

  const actions: RowActions = {
    cardsByBin,
    pendingRotationIds,
    onKill: (rotationId) => void kill(rotationId),
    onUnkill: (rotationId) => void unkill(rotationId),
    onSelectCard: (rotationId, nextCardId) => void moveToCard(rotationId, nextCardId),
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
        rows={view.killed}
        actions={actions}
      />
    </Stack>
  );
}
