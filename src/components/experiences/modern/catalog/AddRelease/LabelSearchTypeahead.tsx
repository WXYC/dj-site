"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { Box, Button, CircularProgress, Input, Sheet, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useSearchLabelsQuery } from "@/lib/features/labels/api";
import type { Label } from "@/lib/features/labels/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

/** Nothing highlighted. Arrow keys and hover are the only way onto a row. */
const NO_HIGHLIGHT = -1;

const NO_LABELS: Label[] = [];

/**
 * Search-backed, MD-gated label picker over `GET /labels/search`. Unlike the
 * artist typeahead, there is no separate "create new" affordance: `createLabel`'s
 * conflict target is the exact label name, so free-typing without picking a
 * row already IS the create path (the caller sends the typed text as `label`
 * and omits `label_id`, and the backend upserts it). This component only
 * needs to surface existing matches early enough that the MD sees a
 * near-duplicate before submitting past it.
 *
 * `value`/`onChange` are caller-owned for the same reason as the artist
 * typeahead: a caller needs to seed and clear this field from outside.
 * `onSelectionCleared` retracts an earlier `onSelect` when the field is
 * edited away from the picked label's name, so a caller does not keep a
 * `label_id` that no longer matches the text it is about to submit.
 */
export interface LabelSearchTypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (label: Label) => void;
  onSelectionCleared: () => void;
  disabled?: boolean;
}

function LabelSearchTypeaheadInner({
  value,
  onChange,
  onSelect,
  onSelectionCleared,
  disabled,
}: LabelSearchTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [rawHighlightIndex, setHighlightIndex] = useState(NO_HIGHLIGHT);
  // Set for the span of a manually triggered retry and cleared once it
  // settles, win or lose. RTK Query clears `isError` the instant a refetch
  // goes pending — well before the retry has an answer — so keying the error
  // panel off `isError` alone would hand that whole in-flight window to
  // `showListbox` whenever a prior successful fetch left rows cached: the
  // stale list would render as current for as long as the retry takes.
  const [retrying, setRetrying] = useState(false);
  const confirmedLabel = useRef<Label | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Row elements by index, kept so the highlight can be scrolled into view.
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Whether the arrow keys, rather than the pointer, put the highlight where it
  // is. Only a keyboard move can land off-screen; a hovered row is by
  // definition under the cursor, and scrolling it flush would slide a different
  // row beneath a cursor that never moved and re-highlight from there.
  const highlightFromKeyboard = useRef(false);
  const listboxId = useId();

  const trimmed = value.trim();
  const debouncedQuery = useDebouncedValue(trimmed, DEBOUNCE_MS);

  const hasValidQuery = trimmed.length >= MIN_QUERY_LENGTH;
  const debouncedIsValid = debouncedQuery.length >= MIN_QUERY_LENGTH;
  const panelOpen = open && !disabled;
  const skip = !panelOpen || !debouncedIsValid;

  const {
    currentData: data,
    isFetching,
    isUninitialized,
    isError,
    refetch,
  } = useSearchLabelsQuery(
    { q: debouncedQuery, limit: RESULT_LIMIT },
    { skip },
  );

  const pendingDebounce = hasValidQuery && debouncedQuery !== trimmed;
  const resultsAreCurrent = hasValidQuery && !pendingDebounce && !skip;
  const labels = resultsAreCurrent ? (data ?? NO_LABELS) : NO_LABELS;

  const showPanel = panelOpen && hasValidQuery;
  // `skip` flipping false does not dispatch the query until the next effect,
  // so the render in between reports `isFetching: false` — RTK Query's
  // uninitialized window. Without `isUninitialized` here that render reads as
  // a completed search with no matches: the "will be created as a new label"
  // copy (and the Enter guard that lets a submit through on it) would fire a
  // beat before the duplicate check has actually been dispatched.
  const isSearching = showPanel && (pendingDebounce || isFetching || isUninitialized);
  // RTK Query keeps the last-good `data` on a rejected refetch, so a
  // background refetch of these same args (a cross-slice cache invalidation,
  // not a keystroke) that fails leaves `data` still holding the prior
  // successful list — `isError` is true with `data` defined. A duplicate
  // check that goes on trusting that list because it happens to be non-empty
  // would report a stale "no match" through exactly the outage it exists to
  // catch, so `showError` does not require `data === undefined`: any error
  // for the current args takes the panel over, stale rows or not. `retrying`
  // extends that same coverage across the button-triggered retry itself,
  // whose pending window clears `isError` before the new attempt resolves.
  const showError = resultsAreCurrent && (isError || retrying);
  const showSearching = isSearching && labels.length === 0 && !showError;
  const showNoMatches = showPanel && !showError && !showSearching && labels.length === 0;
  const showListbox = showPanel && !showError && !showSearching && labels.length > 0;

  // The highlight is local state while the rows come from the query, so nothing
  // structurally holds the two in step across a re-render. Clamping here keeps
  // every index the list no longer has pointing at the last row, and collapses
  // to NO_HIGHLIGHT on an empty list, so `labels[highlightIndex]` below is
  // always a row that exists. There is no create row underneath the results to
  // slide onto — free-typing past the panel already is this field's create
  // path — so the clamp has no sentinel to preserve.
  const highlightIndex =
    rawHighlightIndex >= labels.length ? labels.length - 1 : rawHighlightIndex;

  // The panel is a fixed-height scroller and holds more rows than fit, so a
  // highlight driven past the fold by the arrow keys is reachable but invisible
  // — and Enter would then commit a label id for a row the MD never saw. Scroll
  // offset is browser state React does not model, so keeping the highlight
  // visible has to be a post-render synchronization rather than a derivation.
  // `block: "nearest"` moves the panel only when the row is actually outside it,
  // leaving an already-visible highlight where it is.
  useEffect(() => {
    if (!highlightFromKeyboard.current || highlightIndex < 0) return;
    rowRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const openPanel = useCallback(() => {
    if (disabled) return;
    setOpen(true);
  }, [disabled]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setHighlightIndex(NO_HIGHLIGHT);
  }, []);

  // Focus leaving the field entirely takes the panel with it. The panel is
  // absolutely positioned and stacked above the rest of the form, so one left
  // standing after a Tab covers whatever the MD just moved into, and its Escape
  // dismissal is no longer reachable from there. Containment is checked against
  // the whole wrapper, not just the input, so moving focus to the retry button
  // inside the panel does not close it. Rows suppress the focus shift on
  // mousedown, so a row click never reaches this path at all.
  const handleFocusOut = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      closePanel();
    },
    [closePanel],
  );

  const handleSelect = useCallback(
    (label: Label) => {
      confirmedLabel.current = label;
      onChange(label.label_name);
      onSelect(label);
      closePanel();
    },
    [onChange, onSelect, closePanel],
  );

  const handleTextEdit = useCallback(
    (next: string) => {
      onChange(next);
      if (
        confirmedLabel.current &&
        next.trim() !== confirmedLabel.current.label_name
      ) {
        confirmedLabel.current = null;
        onSelectionCleared();
      }
      setOpen(true);
      setHighlightIndex(NO_HIGHLIGHT);
    },
    [onChange, onSelectionCleared],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape dismisses any open panel, including the error, in-progress and
      // no-match states that have no rows to navigate. The event stops here
      // rather than bubbling: this field is mounted inside a dialog whose own
      // Escape handler closes it and discards the form, and that handler does
      // not consult defaultPrevented — so dismissing a suggestion list would
      // otherwise cost the MD every field they had filled in.
      if (e.key === "Escape" && showPanel) {
        e.preventDefault();
        e.stopPropagation();
        closePanel();
        inputRef.current?.blur();
        return;
      }
      // The panel is open but has no answer yet: the search is still in flight,
      // or it failed outright. Implicit form submission from this input would
      // save the free-typed name past a duplicate check that never completed,
      // and the backend upserts on the exact label name — so "duophonic" would
      // quietly become a second row beside "Duophonic", which is the whole
      // reason this field is a picker instead of a text box.
      if (e.key === "Enter" && (showSearching || showError)) {
        e.preventDefault();
        return;
      }
      if (!showListbox) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          highlightFromKeyboard.current = true;
          setHighlightIndex(Math.min(highlightIndex + 1, labels.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          highlightFromKeyboard.current = true;
          setHighlightIndex(Math.max(highlightIndex - 1, NO_HIGHLIGHT));
          break;
        case "Enter":
          // Swallowed whether or not a row is highlighted: this input sits
          // inside the add-release form, and letting Enter through over an
          // open listbox would submit the release instead of picking the
          // existing label the MD had just navigated to.
          e.preventDefault();
          if (highlightIndex >= 0) {
            handleSelect(labels[highlightIndex]);
          } else {
            // Nothing highlighted, and this field has no create row for the
            // keyboard to land on — so the key would otherwise do nothing at
            // all and leave no way forward but Escape. Dismissing the matches
            // is the answer to "I have seen them and still mean this text":
            // the check has already reported, so the next Enter submits.
            closePanel();
          }
          break;
      }
    },
    [
      showPanel,
      showListbox,
      showSearching,
      showError,
      highlightIndex,
      labels,
      handleSelect,
      closePanel,
    ],
  );

  return (
    <ClickAwayListener onClickAway={closePanel}>
      <Box sx={{ position: "relative", width: "100%" }} onBlur={handleFocusOut}>
        <Input
          size="sm"
          fullWidth
          disabled={disabled}
          placeholder="Search labels..."
          value={value}
          onFocus={openPanel}
          onClick={openPanel}
          onChange={(e) => handleTextEdit(e.target.value)}
          onKeyDown={handleKeyDown}
          startDecorator={
            isSearching ? (
              <CircularProgress
                size="sm"
                sx={{ "--CircularProgress-size": "14px" }}
              />
            ) : undefined
          }
          slotProps={{
            input: {
              ref: inputRef,
              role: "combobox",
              "aria-label": "Search labels",
              "aria-expanded": showListbox,
              "aria-controls": showListbox ? listboxId : undefined,
              "aria-activedescendant":
                showListbox && highlightIndex >= 0
                  ? `${listboxId}-option-${highlightIndex}`
                  : undefined,
              "aria-autocomplete": "list",
              autoComplete: "off",
              spellCheck: false,
            },
          }}
        />

        {showPanel && (
          <Sheet
            variant="outlined"
            {...(showError
              ? { role: "alert" as const }
              : showSearching || showNoMatches
                ? { role: "status" as const }
                : { role: "listbox" as const, id: listboxId })}
            sx={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 8002,
              borderRadius: "md",
              maxHeight: "300px",
              overflowY: "auto",
              boxShadow: "0px 8px 24px -4px rgba(0,0,0,0.4)",
              py: 0.5,
            }}
          >
            {showError ? (
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography level="body-sm">
                  Label search is unavailable. Existing labels can&apos;t be
                  checked right now.
                </Typography>
                <Button
                  size="sm"
                  variant="plain"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    // Moving focus to the input before the next render commits
                    // keeps focus off a node React may remove — losing focus
                    // mid-retry would otherwise drop it to <body>, taking
                    // arrow-key, Enter-to-pick and Escape-to-dismiss with it.
                    setRetrying(true);
                    // `refetch()`'s returned promise resolves with the settled
                    // state on both outcomes — it never rejects — so clearing
                    // `retrying` belongs in `finally`, not a success-only `then`.
                    refetch().finally(() => setRetrying(false));
                    inputRef.current?.focus();
                  }}
                  sx={{ mt: 0.5, px: 0 }}
                >
                  Try again
                </Button>
              </Box>
            ) : showSearching ? (
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography level="body-sm" sx={{ fontStyle: "italic" }}>
                  Searching labels...
                </Typography>
              </Box>
            ) : showNoMatches ? (
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography level="body-sm" sx={{ fontStyle: "italic" }}>
                  {`"${trimmed}" will be created as a new label.`}
                </Typography>
              </Box>
            ) : (
              labels.map((label, index) => (
                <Box
                  key={label.id}
                  ref={(el: HTMLDivElement | null) => {
                    rowRefs.current[index] = el;
                  }}
                  // Indexed rather than keyed by label id so the id the input's
                  // aria-activedescendant names can be derived from the
                  // highlight alone.
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={highlightIndex === index}
                  // Suppressing the default mousedown keeps focus on the input,
                  // so the wrapper's focus-out handler never runs and the panel
                  // is still mounted when this row's `onClick` selection handler
                  // fires. Without it the row unmounts under the pointer between
                  // mousedown and click, and the pick is lost.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(label)}
                  // Pointer motion, not entry: scrolling the keyboard's chosen
                  // row into view slides a different row under a cursor parked
                  // over the panel, and entry alone would then hand that row the
                  // highlight the arrow key had just placed. `mousemove` only
                  // fires when the pointer itself moves, so the keyboard keeps
                  // the highlight until the MD actually reaches for the mouse.
                  onMouseMove={() => {
                    highlightFromKeyboard.current = false;
                    setHighlightIndex(index);
                  }}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    cursor: "pointer",
                    backgroundColor:
                      highlightIndex === index ? "primary.700" : "transparent",
                    "&:hover": {
                      backgroundColor:
                        highlightIndex === index ? "primary.700" : "neutral.800",
                    },
                  }}
                >
                  <Typography
                    level="body-sm"
                    sx={{
                      color: highlightIndex === index ? "white" : "inherit",
                    }}
                  >
                    {label.label_name}
                  </Typography>
                </Box>
              ))
            )}
          </Sheet>
        )}
      </Box>
    </ClickAwayListener>
  );
}

export default function LabelSearchTypeahead(props: LabelSearchTypeaheadProps) {
  return (
    <RequireMD>
      <LabelSearchTypeaheadInner {...props} />
    </RequireMD>
  );
}
