import type { IntakeItem } from "@wxyc/shared";

/**
 * Who has a record. `requested` is a live request (the record is held for that
 * DJ, who has not taken it yet); `removed` is a checkout whose holder's account
 * no longer exists. Names are real names: station display only, never telemetry.
 */
export type Holder = { kind: "none" } | { kind: "removed" } | { kind: "requested" | "checked_out"; id: string | null; name: string };

/**
 * The one place a record's holder is worked out, so every lane and the record
 * page read it the same way. A removed account is `checked_out_by` null while
 * `checked_out_at` is set, never a missing name.
 */
export function itemHolder(item: IntakeItem): Holder {
  const state = item.effective_state;
  if (state === "pool") return { kind: "none" };
  if (state === "requested") return { kind: "requested", id: item.requested_dj_id, name: item.requested_dj_name ?? "" };
  if (item.checked_out_by) return { kind: "checked_out", id: item.checked_out_by, name: item.checked_out_by_name ?? "" };
  return item.checked_out_at && (state === "checked_out" || state === "reviewed") ? { kind: "removed" } : { kind: "none" };
}
