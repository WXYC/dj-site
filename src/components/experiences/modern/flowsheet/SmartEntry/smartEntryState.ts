import { findTriggerOffsets, parseSmartEntry } from "./parser/parseSmartEntry";
import { remapSuppressedTriggers } from "./parser/remapOffsets";
import type { FieldSpan, ParseResult, SmartField } from "./parser/types";

/**
 * Local, keystroke-latency state the composer owns, kept out of Redux so
 * per-keystroke edits don't churn the slice: the raw text, escaped-to-literal
 * trigger offsets, field locks (accepted values that became hard constraints),
 * the Escape-dismissed ghost, and a one-step autofill-undo snapshot (`kind`
 * lets undoing a result fill also clear the selected match).
 */
export type SmartEntryState = {
  raw: string;
  suppressedTriggers: number[];
  locks: Partial<Record<SmartField, string>>;
  dismissedGhost: { field: SmartField; prefix: string } | null;
  autofillUndo: { raw: string; kind: "ghost" | "fill" } | null;
};

export const initialSmartEntryState: SmartEntryState = {
  raw: "",
  suppressedTriggers: [],
  locks: {},
  dismissedGhost: null,
  autofillUndo: null,
};

export type SmartEntryAction =
  /** Controlled-input change (type / paste / cut / delete). */
  | { type: "SET_RAW"; raw: string }
  /** Accept ghost text: replace raw and lock the field to `value`. */
  | { type: "ACCEPT_GHOST"; raw: string; field: SmartField; value: string }
  /** Fill the sentence from a selected result: replace raw, lock the filled
   *  fields, suppress trigger words inside the filled values. `undoKind: "fill"`
   *  arms the one-Backspace undo (which also clears the match); omit it for an
   *  explicit re-song like picking a track, where Backspace should be normal. */
  | {
      type: "FILL_FIELDS";
      raw: string;
      locks: Partial<Record<SmartField, string>>;
      suppress: number[];
      undoKind?: "fill";
    }
  /** Undo the last autofill in one step (Backspace right after a fill). */
  | { type: "UNDO_AUTOFILL" }
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
        autofillUndo: null, // an ordinary edit commits the last autofill
      };
    }

    case "ACCEPT_GHOST": {
      const remapped = remapSuppressedTriggers(
        state.raw,
        action.raw,
        state.suppressedTriggers
      );
      // Escape trigger words inside the accepted value (e.g. "With" in an
      // album title) so the locked field isn't cut in two.
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
        autofillUndo: { raw: state.raw, kind: "ghost" }, // undo the accept
      };
    }

    case "FILL_FIELDS": {
      const remapped = remapSuppressedTriggers(
        state.raw,
        action.raw,
        state.suppressedTriggers
      );
      const suppressedTriggers = Array.from(
        new Set([...remapped, ...action.suppress])
      );
      return {
        raw: action.raw,
        suppressedTriggers,
        locks: { ...state.locks, ...action.locks },
        dismissedGhost: null,
        autofillUndo: action.undoKind
          ? { raw: state.raw, kind: action.undoKind }
          : null,
      };
    }

    case "UNDO_AUTOFILL": {
      if (state.autofillUndo === null) return state;
      const raw = state.autofillUndo.raw;
      const suppressedTriggers = remapSuppressedTriggers(
        state.raw,
        raw,
        state.suppressedTriggers
      );
      const parse = parseSmartEntry(raw, { suppressedTriggers });
      return {
        raw,
        suppressedTriggers,
        locks: pruneLocks(state.locks, parse),
        dismissedGhost: null,
        autofillUndo: null,
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
