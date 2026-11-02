import type { RotationCard } from "@wxyc/shared";
import type { RotationListRow } from "@/lib/features/rotation/types";

/** The card as text: "card 2 — Jazz & beyond", or "card 3" unnamed, or "no card". */
export function cardText(card: RotationCard | null | undefined): string {
  if (!card) return "no card";
  return card.name ? `card ${card.number} — ${card.name}` : `card ${card.number}`;
}

/**
 * The name every per-row control carries in its accessible label, so a list
 * of identical icon buttons still says which release each one acts on.
 */
export function shelfRowName(row: RotationListRow): string {
  return row.album_title ?? row.artist_name ?? `rotation ${row.rotation_id}`;
}
