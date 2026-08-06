"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { Box, Button, CircularProgress, Input, Sheet, Typography } from "@mui/joy";
import { useSearchLabelsQuery } from "@/lib/features/labels/api";
import type { LabelRow } from "@/lib/features/labels/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

/** Nothing highlighted. Arrow keys and hover are the only way onto a row. */
const NO_HIGHLIGHT = -1;

const NO_LABELS: LabelRow[] = [];

/**
 * Search-backed label picker over `GET /labels/search`. Unlike the artist
 * typeahead, there is no separate "create new" affordance: `createLabel`'s
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
  onSelect: (label: LabelRow) => void;
  onSelectionCleared: () => void;
  disabled?: boolean;
}

export default function LabelSearchTypeahead({
  value,
  onChange,
  onSelect,
  onSelectionCleared,
  disabled,
}: LabelSearchTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [rawHighlightIndex, setHighlightIndex] = useState(NO_HIGHLIGHT);
  const confirmedLabel = useRef<LabelRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
  const isSearching = showPanel && (pendingDebounce || isFetching);
  const showError = resultsAreCurrent && isError && data === undefined;
  const showSearching = isSearching && labels.length === 0 && !showError;
  const showNoMatches = showPanel && !showError && !showSearching && labels.length === 0;
  const showListbox = showPanel && !showError && !showSearching && !showNoMatches;

  // The highlight is local state while the rows come from the query, so nothing
  // structurally holds the two in step across a re-render. Clamping here keeps
  // every index the list no longer has pointing at the last row, and collapses
  // to NO_HIGHLIGHT on an empty list, so `labels[highlightIndex]` below is
  // always a row that exists. There is no create row underneath the results to
  // slide onto — free-typing past the panel already is this field's create
  // path — so the clamp has no sentinel to preserve.
  const highlightIndex =
    rawHighlightIndex >= labels.length ? labels.length - 1 : rawHighlightIndex;

  const openPanel = useCallback(() => {
    if (disabled) return;
    setOpen(true);
  }, [disabled]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setHighlightIndex(NO_HIGHLIGHT);
  }, []);

  const handleSelect = useCallback(
    (label: LabelRow) => {
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
          setHighlightIndex(Math.min(highlightIndex + 1, labels.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
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
      <Box sx={{ position: "relative", width: "100%" }}>
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
                  onClick={() => refetch()}
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
            ) : labels.length === 0 ? (
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography level="body-sm" sx={{ fontStyle: "italic" }}>
                  {`"${trimmed}" will be created as a new label.`}
                </Typography>
              </Box>
            ) : (
              labels.map((label, index) => (
                <Box
                  key={label.id}
                  // Indexed rather than keyed by label id so the id the input's
                  // aria-activedescendant names can be derived from the
                  // highlight alone.
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={highlightIndex === index}
                  // preventDefault keeps focus on the input so neither the
                  // click-away nor the blur path closes the panel before this
                  // row's `onClick` selection handler runs.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(label)}
                  onMouseEnter={() => setHighlightIndex(index)}
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
