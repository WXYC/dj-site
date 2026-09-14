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

export interface CardPickerProps {
  bin: RotationBin;
  /**
   * Selected card id. When null the picker defaults it (via `onChange`) to
   * the bin's newest card; a caller-supplied id -- an existing assignment --
   * is displayed as-is and never overwritten unless it names a card in a
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
 * Chip row of a bin's cards. The parent owns the selection; the picker only
 * fills it in when it is unset or stale (see `CardPickerProps.value`).
 */
function CardPicker({ bin, value, onChange }: CardPickerProps) {
  const { data: cards, isLoading, refetch } = useGetRotationCardsQuery();
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

  // Pushes the defaulted id up to the parent so it holds the resolved card at
  // submit time without re-deriving "newest" itself. Fires only while `value`
  // is unset or names a card in another bin (stale after a bin change); an id
  // the list doesn't know at all is left alone -- it is either a just-created
  // card whose refetch hasn't landed or a caller-supplied assignment racing a
  // stale list, and neither may be overwritten.
  useEffect(() => {
    if (!cards) return;
    const valueKnown = value != null && cards.some((card) => card.id === value);
    const valueInBin = value != null && binCards.some((card) => card.id === value);
    if (value != null && (valueInBin || !valueKnown)) return;
    onChange(newestCard(binCards)?.id ?? null);
  }, [cards, binCards, value, onChange]);

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

  if (isLoading) {
    return <CircularProgress size="sm" aria-label="Loading cards" />;
  }

  // A settled query without data is a failed load; cached cards from a
  // previous success keep rendering through a failed refetch instead.
  if (!cards) {
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
      <Stack direction="row" spacing={1} flexWrap="wrap" role="group" aria-label="Card">
        {binCards.map((card) => (
          <Chip
            key={card.id}
            size="sm"
            variant={value === card.id ? "solid" : "soft"}
            color={value === card.id ? "primary" : "neutral"}
            onClick={() => onChange(card.id)}
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
