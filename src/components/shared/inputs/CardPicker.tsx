"use client";

import { useEffect, useRef, useState } from "react";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { RotationBin, RotationCard } from "@wxyc/shared";
import {
  useAddRotationCardMutation,
  useGetRotationCardsQuery,
} from "@/lib/features/rotation/api";

export interface CardPickerProps {
  bin: RotationBin;
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
 * Chip row of a bin's cards, defaulting the caller's selection to the bin's
 * newest card on mount and again whenever `bin` changes -- a card id from the
 * previous bin never names a card in the new one.
 */
function CardPicker({ bin, value, onChange }: CardPickerProps) {
  const { data: cards } = useGetRotationCardsQuery();
  const [addRotationCard, { isLoading: isCreating }] = useAddRotationCardMutation();
  const binCards = (cards ?? []).filter((card) => card.bin === bin);
  const [createError, setCreateError] = useState(false);

  // Guards the default against re-firing on every cards refetch (e.g. a
  // sibling picker creating a card in a different bin) so a manual pick
  // within the same bin survives -- only an actual bin change re-defaults.
  const defaultedBinRef = useRef<RotationBin | null>(null);
  useEffect(() => {
    if (!cards || defaultedBinRef.current === bin) return;
    defaultedBinRef.current = bin;
    setCreateError(false);
    onChange(newestCard(binCards)?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- binCards/onChange are recomputed every render; only bin/cards mark a real change worth re-defaulting for.
  }, [bin, cards]);

  async function handleCreate() {
    setCreateError(false);
    try {
      const created = await addRotationCard({ bin }).unwrap();
      onChange(created.id);
    } catch {
      setCreateError(true);
    }
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
      {createError && (
        <Typography level="body-xs" color="danger">
          Failed to create a card.
        </Typography>
      )}
    </Stack>
  );
}

export default CardPicker;
