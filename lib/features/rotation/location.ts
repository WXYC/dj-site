import { ROTATION_BIN_LABELS, type Rotation } from "./types";
import type { RotationCard } from "@wxyc/shared/dtos";

export type RotationLocation = {
  /** Short display text: `H · card 2`, or just the bin when no card is known. */
  label: string;
  /** Full-sentence tooltip, carrying the card's optional name. */
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
    return { label: rotation_bin, title: `${binLabel} rotation` };
  }

  const named = card.name ? ` "${card.name}"` : "";
  return {
    label: `${rotation_bin} · card ${card.number}`,
    title: `${binLabel} rotation, card ${card.number}${named}`,
  };
}
