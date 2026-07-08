import { findTriggerOffsets, parseSmartEntry } from "./parser/parseSmartEntry";
import { remapSuppressedTriggers } from "./parser/remapOffsets";
import type { FieldSpan, ParseResult, SmartField } from "./parser/types";

/**
 * Local, keystroke-latency state the smart-entry composer owns (kept out of
 * Redux so per-keystroke edits don't churn the slice or its protected tests):
 *
 *  - `raw` — the exact text the DJ is editing (single source of truth).
 *  - `suppressedTriggers` — start offsets of trigger words escaped to literal.
 *  - `locks` — field → the accepted value that locked it as a hard constraint.
 *  - `dismissedGhost` — a (field, prefix) whose ghost the DJ dismissed with
 *    Escape, so it doesn't immediately reappear until they type more.
 */
export type SmartEntryState = {
  raw: string;
  suppressedTriggers: number[];
  locks: Partial<Record<SmartField, string>>;
  dismissedGhost: { field: SmartField; prefix: string } | null;
};

export const initialSmartEntryState: SmartEntryState = {
  raw: "",
  suppressedTriggers: [],
  locks: {},
  dismissedGhost: null,
};

export type SmartEntryAction =
  /** Controlled-input change (type / paste / cut / delete). */
  | { type: "SET_RAW"; raw: string }
  /** Accept ghost text: replace raw and lock the field to `value`. */
  | { type: "ACCEPT_GHOST"; raw: string; field: SmartField; value: string }
  /** Lock a field to a committed value without changing raw (e.g. suggestion). */
  | { type: "LOCK_FIELD"; field: SmartField; value: string }
  /** Escape rung 1: dismiss the current ghost for (field, prefix). */
  | { type: "DISMISS_GHOST"; field: SmartField; prefix: string }
  /** Escape rung 2: suppress the newest active trigger word. */
  | { type: "SUPPRESS_NEWEST_TRIGGER" }
  /** Escape rung 4 (partial): clear all locks. */
  | { type: "CLEAR_LOCKS" }
  /** Escape rung 5 / submit / reset: back to empty. */
  | { type: "RESET" };

/** Trigger words present in the parse (spans + a trailing pending trigger). */
function triggerOffsets(parse: ParseResult): number[] {
  const offsets = parse.spans
    .filter((s: FieldSpan) => s.triggerStart !== undefined)
    .map((s) => s.triggerStart as number);
  if (parse.pendingTrigger) offsets.push(parse.pendingTrigger.start);
  return offsets;
}

/**
 * Drop locks whose value no longer matches the freshly parsed field value —
 * editing inside or around a locked span silently unlocks it (widening the
 * search again) rather than trapping the DJ.
 */
function pruneLocks(
  locks: Partial<Record<SmartField, string>>,
  parse: ParseResult
): Partial<Record<SmartField, string>> {
  const next: Partial<Record<SmartField, string>> = {};
  for (const field of Object.keys(locks) as SmartField[]) {
    if (parse.fields[field] === locks[field]) next[field] = locks[field];
  }
  return next;
}

export function smartEntryReducer(
  state: SmartEntryState,
  action: SmartEntryAction
): SmartEntryState {
  switch (action.type) {
    case "SET_RAW": {
      const suppressedTriggers = remapSuppressedTriggers(
        state.raw,
        action.raw,
        state.suppressedTriggers
      );
      const parse = parseSmartEntry(action.raw, { suppressedTriggers });
      return {
        raw: action.raw,
        suppressedTriggers,
        locks: pruneLocks(state.locks, parse),
        dismissedGhost: null, // any edit reopens ghost consideration
      };
    }

    case "ACCEPT_GHOST": {
      const remapped = remapSuppressedTriggers(
        state.raw,
        action.raw,
        state.suppressedTriggers
      );
      // Auto-escape any trigger word that landed inside the accepted value
      // (e.g. "With" in an album title) so it stays literal and the locked
      // field isn't cut in two. The value sits at the end of raw.
      const valueStart = action.raw.length - action.value.length;
      const intraValue = findTriggerOffsets(action.raw).filter(
        (offset) => offset >= valueStart
      );
      const suppressedTriggers = Array.from(new Set([...remapped, ...intraValue]));
      return {
        raw: action.raw,
        suppressedTriggers,
        locks: { ...state.locks, [action.field]: action.value },
        dismissedGhost: null,
      };
    }

    case "LOCK_FIELD":
      return {
        ...state,
        locks: { ...state.locks, [action.field]: action.value },
      };

    case "DISMISS_GHOST":
      return {
        ...state,
        dismissedGhost: { field: action.field, prefix: action.prefix },
      };

    case "SUPPRESS_NEWEST_TRIGGER": {
      const parse = parseSmartEntry(state.raw, {
        suppressedTriggers: state.suppressedTriggers,
      });
      const offsets = triggerOffsets(parse);
      if (offsets.length === 0) return state; // nothing to suppress
      const newest = Math.max(...offsets);
      if (state.suppressedTriggers.includes(newest)) return state;
      return {
        ...state,
        suppressedTriggers: [...state.suppressedTriggers, newest],
      };
    }

    case "CLEAR_LOCKS":
      return { ...state, locks: {} };

    case "RESET":
      return initialSmartEntryState;

    default:
      return state;
  }
}

/** Has this composer any active interpretation state to back out of? */
export function hasActiveTrigger(state: SmartEntryState): boolean {
  const parse = parseSmartEntry(state.raw, {
    suppressedTriggers: state.suppressedTriggers,
  });
  return triggerOffsets(parse).length > 0;
}
