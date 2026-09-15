import { ROTATION_BIN_LABELS, type Rotation } from "./types";
import type { RotationCard } from "@wxyc/shared/dtos";

export type RotationLocation = {
  /** Bin code for compact inline display (`H`, `M`, `L`, `S`), always present. */
  bin: Rotation;
  /**
   * Card number for the circular badge, or `null` when no specific card is
   * known (older Backend, or a cache row that predates the card widening) — a
   * render site degrades to the bin alone rather than a broken badge.
   */
  cardNumber: number | null;
  /** The card's optional human name, shown beside the badge where space allows. */
  cardName: string | null;
  /** Full-sentence accessible label/tooltip, carrying the card's optional name. */
  title: string;
};

/**
 * Where a rotating release actually sits, for surfaces that swap the call
 * number (not on the stacks) for the record's physical location. Returns
 * `null` for a non-rotating row. `card` absent or `null` (older Backend, or
 * a cache row that predates the card widening) degrades to the bin alone
 * rather than a broken pill.
 */
export function rotationLocationFor(
  rotation_bin: Rotation | undefined,
  card: RotationCard | null | undefined
): RotationLocation | null {
  if (!rotation_bin) return null;

  const binLabel = ROTATION_BIN_LABELS[rotation_bin];

  if (!card) {
    return { bin: rotation_bin, cardNumber: null, cardName: null, title: `${binLabel} rotation` };
  }

  // Typographic curly quotes in the accessible title, matching the visual spec
  // character-for-character.
  const named = card.name ? ` “${card.name}”` : "";
  return {
    bin: rotation_bin,
    cardNumber: card.number,
    cardName: card.name ?? null,
    title: `${binLabel} rotation, card ${card.number}${named}`,
  };
}
