"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { SyntheticEvent } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import type { SelectedMatch } from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector, useAppStore } from "@/lib/hooks";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { useFlowsheetSubmit } from "@/src/hooks/flowsheetHooks";
import { parseSmartEntry } from "./parser/parseSmartEntry";
import type { FieldSpan, ParseResult } from "./parser/types";
import { buildPendingQuery, selectedMatchApplies } from "./buildPendingQuery";
import {
  hasActiveTrigger,
  initialSmartEntryState,
  smartEntryReducer,
} from "./smartEntryState";

const PARSED_FIELDS_DEBOUNCE_MS = 200;

/** Full four-field payload for `setParsedFields` (absent fields → ""). */
function fullParsedFields(parse: ParseResult): {
  song: string;
  artist: string;
  album: string;
  label: string;
} {
  return {
    song: parse.fields.song ?? "",
    artist: parse.fields.artist ?? "",
    album: parse.fields.album ?? "",
    label: parse.fields.label ?? "",
  };
}

/** Project a catalog/rotation result row into a serializable selected match. */
export function albumEntryToSelectedMatch(entry: AlbumEntry): SelectedMatch {
  return {
    id: entry.id,
    // Only a real, positive library id counts as linkage (mirrors #701).
    album_id: entry.id > 0 ? entry.id : undefined,
    rotation_id: entry.rotation_id,
    rotation_bin: entry.rotation_bin,
    artist: entry.artist?.name ?? "",
    album: entry.title ?? "",
    label: entry.label ?? "",
    format: entry.format,
    on_streaming: entry.on_streaming,
    artwork_url: entry.artwork_url,
    lettercode: entry.artist?.lettercode,
    numbercode: entry.artist?.numbercode,
    genre: entry.artist?.genre,
    entry: entry.entry,
  };
}

/**
 * Headless state + actions for the smart-entry composer. Owns the raw text and
 * interpretation state locally (via `smartEntryReducer`), writes the parsed
 * fields into `flowsheetSlice.search.query` on a debounce so the existing
 * search sources keep working, and bridges commit/queue to `useFlowsheetSubmit`.
 *
 * Ghost-text acceptance and results arrow-navigation are layered on in later
 * phases; the extension points (`selectMatch`, `clearMatch`, the Escape ladder)
 * are already wired.
 */
export function useFlowsheetSmartEntry() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const [state, localDispatch] = useReducer(
    smartEntryReducer,
    initialSmartEntryState
  );

  const selectedMatch = useAppSelector(
    flowsheetSlice.selectors.getSelectedMatch
  );
  const searchOpen = useAppSelector(flowsheetSlice.selectors.getSearchOpen);
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );
  const { handleSubmit, ctrlKeyPressed } = useFlowsheetSubmit();

  // Immediate parse for rendering the mirror/highlights.
  const parse = useMemo(
    () =>
      parseSmartEntry(state.raw, {
        suppressedTriggers: state.suppressedTriggers,
      }),
    [state.raw, state.suppressedTriggers]
  );

  // Stamp spans whose field value equals its lock as "locked".
  const spans = useMemo<FieldSpan[]>(
    () =>
      parse.spans.map((span) =>
        state.locks[span.field] !== undefined &&
        state.locks[span.field] === parse.fields[span.field]
          ? { ...span, source: "locked" }
          : span
      ),
    [parse, state.locks]
  );

  // Debounced write of the parsed fields into the slice (all four sources read
  // search.query). Suppression changes are discrete (Escape) → react at once.
  const debouncedRaw = useDebouncedValue(state.raw, PARSED_FIELDS_DEBOUNCE_MS);
  useEffect(() => {
    const parsed = parseSmartEntry(debouncedRaw, {
      suppressedTriggers: state.suppressedTriggers,
    });
    dispatch(flowsheetSlice.actions.setParsedFields(fullParsedFields(parsed)));
  }, [debouncedRaw, state.suppressedTriggers, dispatch]);

  // Drop a selected match once the typed identity fields diverge from it.
  useEffect(() => {
    if (selectedMatch && !selectedMatchApplies(searchQuery, selectedMatch)) {
      dispatch(flowsheetSlice.actions.clearSelectedMatch());
    }
  }, [searchQuery, selectedMatch, dispatch]);

  /** Synchronously commit the current parse into the slice (pre-submit). */
  const flush = useCallback(() => {
    const parsed = parseSmartEntry(state.raw, {
      suppressedTriggers: state.suppressedTriggers,
    });
    dispatch(flowsheetSlice.actions.setParsedFields(fullParsedFields(parsed)));
  }, [state.raw, state.suppressedTriggers, dispatch]);

  const onRawChange = useCallback(
    (raw: string) => {
      localDispatch({ type: "SET_RAW", raw });
      if (raw.trim() !== "") {
        dispatch(flowsheetSlice.actions.setSearchOpen(true));
      }
    },
    [dispatch]
  );

  const reset = useCallback(() => {
    localDispatch({ type: "RESET" });
    dispatch(flowsheetSlice.actions.resetSearch());
  }, [dispatch]);

  /** Commit a catalog/rotation result as the selected match (P4 results wire). */
  const selectMatch = useCallback(
    (entry: AlbumEntry) => {
      dispatch(
        flowsheetSlice.actions.setSelectedMatch(albumEntryToSelectedMatch(entry))
      );
      dispatch(flowsheetSlice.actions.setSelectedResult(0));
    },
    [dispatch]
  );

  const clearMatch = useCallback(() => {
    dispatch(flowsheetSlice.actions.clearSelectedMatch());
  }, [dispatch]);

  /**
   * Commit the pending entry. Flushes the parse, reads the fresh store (never a
   * stale selector closure), merges the selected match, and hands off to
   * `useFlowsheetSubmit` (which owns the queue-modifier race guard, toasts, and
   * `resetSearch`). Local state clears only when a submission actually proceeds
   * (a missing song title is rejected by handleSubmit with a toast).
   */
  const submit = useCallback(
    (e: SyntheticEvent) => {
      flush();
      const s = store.getState();
      const merged = buildPendingQuery(
        flowsheetSlice.selectors.getSearchQuery(s),
        flowsheetSlice.selectors.getSelectedMatch(s)
      );
      void handleSubmit(e as never, merged);
      if (merged.song.trim() !== "") {
        localDispatch({ type: "RESET" });
      }
    },
    [flush, store, handleSubmit]
  );

  /**
   * Escape ladder — back out one level per press. Returns true when a rung
   * fired (caller should preventDefault). Rung 1 (dismiss ghost) is added with
   * ghost text in a later phase.
   */
  const handleEscape = useCallback((): boolean => {
    if (hasActiveTrigger(state)) {
      localDispatch({ type: "SUPPRESS_NEWEST_TRIGGER" });
      return true;
    }
    if (selectedMatch) {
      dispatch(flowsheetSlice.actions.clearSelectedMatch());
      return true;
    }
    if (Object.keys(state.locks).length > 0 || searchOpen) {
      localDispatch({ type: "CLEAR_LOCKS" });
      dispatch(flowsheetSlice.actions.setSearchOpen(false));
      return true;
    }
    if (state.raw !== "") {
      reset();
      return true;
    }
    return false;
  }, [state, selectedMatch, searchOpen, dispatch, reset]);

  return {
    raw: state.raw,
    spans,
    fields: parse.fields,
    fieldOrder: parse.fieldOrder,
    pendingTrigger: parse.pendingTrigger,
    locks: state.locks,
    suppressedTriggers: state.suppressedTriggers,
    selectedMatch,
    selectedResult,
    ctrlKeyPressed,
    onRawChange,
    submit,
    reset,
    flush,
    selectMatch,
    clearMatch,
    handleEscape,
  };
}
