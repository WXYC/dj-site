"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { RotationBin, RotationCard } from "@wxyc/shared";
import {
  useAddRotationCardMutation,
  useGetRotationCardsQuery,
} from "@/lib/features/rotation/api";
import { ROTATION_BIN_LABELS } from "@/lib/features/rotation/types";

export interface CardPickerProps {
  bin: RotationBin;
  /**
   * Selected card id. When null the picker defaults it (via `onChange`) to
   * the bin's newest card; a caller-supplied id -- an existing assignment --
   * is displayed as-is, never overwritten, unless it names a card in a
   * different bin, which can only mean `bin` changed out from under it.
   */
  value: number | null;
  onChange: (cardId: number | null) => void;
}

function cardLabel(card: RotationCard): string {
  return card.name ? `${card.number} · ${card.name}` : `${card.number}`;
}

/**
 * The bin's newest card: highest `number`, `id` descending as the tie-break
 * (pinned in wxyc-shared#460 -- `number` has no gaps, so a tie only arises
 * from stale cache data racing a real add).
 */
function newestCard(cards: RotationCard[]): RotationCard | undefined {
  return cards.reduce<RotationCard | undefined>((newest, card) => {
    if (!newest) return card;
    if (card.number !== newest.number) return card.number > newest.number ? card : newest;
    return card.id > newest.id ? card : newest;
  }, undefined);
}

/**
 * Chip row of a bin's cards. The parent owns the selection; the picker
 * derives the effective one during render (see `CardPickerProps.value`) and
 * pushes a changed default up so the parent holds the resolved card id at
 * submit time without re-deriving "newest" itself.
 */
function CardPicker({ bin, value, onChange }: CardPickerProps) {
  const { data: cards, isFetching, refetch } = useGetRotationCardsQuery();
  const [addRotationCard, { isLoading: isCreating }] = useAddRotationCardMutation();
  const binCards = useMemo(
    () => (cards ?? []).filter((card) => card.bin === bin),
    [cards, bin],
  );
  // Which bin a failed create belonged to, so the message never shows under
  // a bin the failure didn't happen in -- a bin switch hides it by derivation
  // rather than by a clearing side effect.
  const [createErrorBin, setCreateErrorBin] = useState<RotationBin | null>(null);

  // `handleCreate`'s post-await continuation must observe `bin` as of
  // resolution time, not click time, so it can discard a create that
  // resolved after the parent switched bins.
  const binRef = useRef(bin);
  useEffect(() => {
    binRef.current = bin;
  }, [bin]);

  // The selection this picker displays and a save should use, derived every
  // render. `value` wins while it is set and not stale (stale = it names a
  // card in another bin, which only a bin change can produce); an id the
  // list doesn't know at all is kept too -- it is either a just-created card
  // whose refetch hasn't landed or a caller-supplied assignment racing a
  // stale list, and neither may be overwritten.
  const valueKnown = value != null && (cards ?? []).some((card) => card.id === value);
  const valueInBin = value != null && binCards.some((card) => card.id === value);
  const keepCallerValue = value != null && (valueInBin || !valueKnown);
  const effectiveValue = keepCallerValue ? value : (newestCard(binCards)?.id ?? null);

  // Pushes a changed default up to the parent. At most one write per
  // (bin, cards) change *or observed `value` move: the latch, not the deps,
  // bounds the writes, so a parent that re-renders with a fresh `onChange`
  // identity -- or refuses the value outright -- can never loop this effect.
  // A `value` move re-arms the latch because it is the discriminator between
  // "the parent rejected our default" (value never moved; stay latched) and
  // "the parent deliberately cleared or changed it" (e.g. a form reset
  // between filings with the bin unchanged), which must get the default
  // re-pushed or the pressed chip diverges from what a submit would save. A
  // refusing parent never moves `value`, so it never re-arms. No write
  // happens when the derived selection already equals `value` (an empty bin
  // with nothing selected stays silent).
  const pushedForRef = useRef<{ bin: RotationBin; cards: RotationCard[] } | null>(null);
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (!cards) return;
    const valueMoved = lastValueRef.current !== value;
    lastValueRef.current = value;
    const pushed = pushedForRef.current;
    if (!valueMoved && pushed && pushed.bin === bin && pushed.cards === cards) return;
    pushedForRef.current = { bin, cards };
    if (effectiveValue !== value) onChange(effectiveValue);
  }, [bin, cards, effectiveValue, value, onChange]);

  async function handleCreate() {
    const requestedBin = bin;
    setCreateErrorBin(null);
    try {
      const created = await addRotationCard({ bin: requestedBin }).unwrap();
      // The parent may have switched bins while the POST was in flight; a
      // card belonging to the previous bin must not become the selection.
      if (binRef.current !== requestedBin) return;
      onChange(created.id);
    } catch {
      setCreateErrorBin(requestedBin);
    }
  }

  // Without data every request is blocking, the initial load and a retry
  // alike -- `isFetching` (unlike `isLoading`) stays true across refetches,
  // so pressing Retry visibly does something. Cached cards from a previous
  // success keep rendering through a failed refetch instead.
  if (!cards) {
    if (isFetching) {
      return <CircularProgress size="sm" aria-label="Loading cards" />;
    }
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="body-xs" color="danger">
          Unable to load cards.
        </Typography>
        <Button size="sm" variant="plain" onClick={() => refetch()}>
          Retry
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={0.5}>
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        role="group"
        aria-label={`${ROTATION_BIN_LABELS[bin]} rotation cards`}
      >
        {binCards.map((card) => (
          <Chip
            key={card.id}
            size="sm"
            variant={effectiveValue === card.id ? "solid" : "soft"}
            color={effectiveValue === card.id ? "primary" : "neutral"}
            onClick={() => onChange(card.id)}
            // The solid-vs-soft fill is invisible to assistive tech; the
            // pressed state carries the selection into the accessibility
            // tree. It goes on the action slot because that is the element
            // with the button role, not the Chip's root div.
            slotProps={{ action: { "aria-pressed": effectiveValue === card.id } }}
          >
            {cardLabel(card)}
          </Chip>
        ))}
        <Chip
          size="sm"
          variant="outlined"
          color="primary"
          disabled={isCreating}
          onClick={handleCreate}
          sx={{ borderStyle: "dashed" }}
        >
          + new card
        </Chip>
      </Stack>
      {createErrorBin === bin && (
        <Typography level="body-xs" color="danger">
          Failed to create a card.
        </Typography>
      )}
    </Stack>
  );
}

export default CardPicker;
