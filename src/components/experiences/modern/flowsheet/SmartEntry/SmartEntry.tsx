"use client";

import { Close, PlayArrow, QueueMusic } from "@mui/icons-material";
import {
  Box,
  Divider,
  IconButton,
  Sheet,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import { ClickAwayListener, Popper, useMediaQuery } from "@mui/material";
import { Transition } from "react-transition-group";
import type { Modifier } from "@popperjs/core";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useGhostText, type GhostTextField } from "@/src/hooks/useGhostText";
import BreakpointButton from "../Search/BreakpointButton";
import TalksetButton from "../Search/TalksetButton";
import SmartComposer from "./SmartComposer";
import SmartResults from "./SmartResults";
import SmartToolbar from "./SmartToolbar";
import TriggerChips from "./TriggerChips";
import {
  insertTriggerWord,
  removeTrailingTrigger,
  replaceTriggerWord,
} from "./insertTriggerWord";
import {
  cycleTriggerField,
  nextTriggerField,
  TRIGGER_WORD,
} from "./triggerWords";
import type { SmartField } from "./parser/types";
import { useFlowsheetSmartEntry } from "./useFlowsheetSmartEntry";
import { useSmartEntrySearch } from "./useSmartEntrySearch";

/** Match the results panel width to the composer shell. */
const sameWidth: Modifier<"sameWidth", object> = {
  name: "sameWidth",
  enabled: true,
  phase: "beforeWrite",
  requires: ["computeStyles"],
  fn: ({ state }) => {
    state.styles.popper.width = `${state.rects.reference.width}px`;
  },
  effect: ({ state }) => {
    const reference = state.elements.reference;
    if (reference instanceof HTMLElement) {
      state.elements.popper.style.width = `${reference.offsetWidth}px`;
    }
  },
};

/**
 * The v2 flowsheet smart-entry component: a single continuous composer that
 * parses natural-language trigger-word input (`song by artist on album via
 * label`) into a pending entry, over the existing four-source search, with an
 * anchored results panel. Slots into the flowsheet page in place of the old
 * segmented bar.
 */
export default function SmartEntry() {
  const entry = useFlowsheetSmartEntry();
  const search = useSmartEntrySearch(entry.locks);
  const { live } = useShowControl();
  const dispatch = useAppDispatch();
  const searchOpen = useAppSelector(flowsheetSlice.selectors.getSearchOpen);
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);

  const flatCount = search.flat.length;
  // Composing an entry (has text) swaps the action cluster from the entry
  // markers (breakpoint/talkset) to the commit + clear buttons.
  const isComposing = entry.raw.trim() !== "";
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)"
  );

  // The active outline colour: success while Ctrl/⌘ is held (next commit
  // queues), otherwise primary. Applied per-side to the shell and the panel so
  // the outline reads as one continuous shape around both.
  const activePalette = entry.ctrlKeyPressed ? "success" : "primary";
  const activeBorder = focused
    ? `${activePalette}.500`
    : "neutral.outlinedBorder";

  // Ghost text for the field the caret is at the end of. Album has no suggest
  // endpoint — feed the top result's title as the override; label gets none.
  const activeField = entry.activeField;
  const activeValue = entry.fields[activeField] ?? "";
  const effectiveArtist =
    entry.locks.artist ?? search.selectedMatch?.artist ?? entry.fields.artist ?? "";
  const albumOverride =
    activeField === "album" ? search.flat[0]?.title ?? undefined : undefined;
  const ghostField: GhostTextField =
    activeField === "label" ? "album" : activeField;
  const ghost = useGhostText(
    ghostField,
    activeValue,
    effectiveArtist,
    albumOverride
  );
  const ghostDismissed =
    entry.dismissedGhost?.field === activeField &&
    entry.dismissedGhost?.prefix === activeValue;
  const ghostSuffix = focused && !ghostDismissed ? ghost.ghostSuffix : "";

  // After a trigger chip (or Tab) splices a word in, the controlled textarea
  // re-renders with the new value; restore the caret (and focus) to just past
  // the inserted word so the DJ can type the field value straight away.
  const pendingCaretRef = useRef<number | null>(null);
  useEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [entry.raw]);

  const insertTrigger = (word: string) => {
    const el = inputRef.current;
    const len = entry.raw.length;
    const selStart = el?.selectionStart ?? len;
    const selEnd = el?.selectionEnd ?? len;
    const { raw, caret } = insertTriggerWord(entry.raw, selStart, selEnd, word);
    pendingCaretRef.current = caret;
    entry.onRawChange(raw);
  };

  // The pre-insertion snapshot of the most recent Tab-advance, so a following
  // Shift+Tab can undo it ("stop with this"). Set only by Tab; cleared the
  // moment the DJ types (real edits go through handleRawChange), so the undo is
  // available *only* immediately after tabbing.
  const tabUndoRef = useRef<{ raw: string; caret: number } | null>(null);
  const handleRawChange = (raw: string) => {
    tabUndoRef.current = null;
    entry.onRawChange(raw);
  };

  /** Revert to the snapshot taken before the current Tab sequence (removing the
   *  whole trigger word). Returns false when there's nothing to undo. */
  const restoreTabBase = (): boolean => {
    const snap = tabUndoRef.current;
    if (!snap) return false;
    tabUndoRef.current = null;
    pendingCaretRef.current = snap.caret;
    entry.onRawChange(snap.raw);
    return true;
  };

  /** Backspace at the end of the line: right after a Tab it removes the whole
   *  trigger word (not one character); otherwise it defers to the autofill
   *  undo (ghost accept / result fill). */
  const handleBackspaceAtEnd = (): boolean =>
    restoreTabBase() || entry.undoAutofill();

  // A field is "claimed" once it has a parsed value or a trailing trigger is
  // already awaiting one — its chip is dropped and Tab skips past it
  // (first-wins parser).
  const isClaimed = (field: SmartField) =>
    Boolean(entry.fields[field]) || entry.pendingTrigger?.field === field;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        dispatch(flowsheetSlice.actions.setSearchOpen(true));
        entry.setHighlight(Math.min(entry.selectedResult + 1, flatCount));
        return;
      case "ArrowUp":
        e.preventDefault();
        entry.setHighlight(Math.max(entry.selectedResult - 1, 0));
        return;
      case "Tab": {
        const el = inputRef.current;
        const caretAtEnd = el
          ? el.selectionStart === el.value.length &&
            el.selectionEnd === el.value.length
          : false;

        if (e.shiftKey) {
          // Shift+Tab immediately after a Tab undoes that advance ("stop with
          // this" / back out the just-added field). Only available right after
          // tabbing; otherwise it falls through to normal reverse focus
          // movement so the DJ can still leave the composer.
          if (isComposing && restoreTabBase()) e.preventDefault();
          return;
        }

        // Tab only acts from the end of the line while composing; otherwise it's
        // normal focus movement.
        if (!isComposing || !caretAtEnd) return;

        const pending = entry.pendingTrigger;
        if (pending && pending.field !== "song") {
          // A value-less trailing trigger is already there (we just tabbed):
          // cycle its word to the next open field instead of stacking another —
          // by → on → via → (removed) → wraps on the next Tab.
          e.preventDefault();
          const next = cycleTriggerField(pending.field, (f) =>
            Boolean(entry.fields[f])
          );
          if (next) {
            const { raw, caret } = replaceTriggerWord(
              entry.raw,
              pending.start,
              pending.end,
              TRIGGER_WORD[next]
            );
            pendingCaretRef.current = caret;
            entry.onRawChange(raw);
          } else if (!restoreTabBase()) {
            // Cycled past the last field → back to the pre-trigger text.
            const { raw, caret } = removeTrailingTrigger(
              entry.raw,
              pending.start,
              pending.end
            );
            pendingCaretRef.current = caret;
            entry.onRawChange(raw);
          }
          return;
        }

        // Otherwise advance into the next unspecified field (artist → album →
        // label, skipping any already filled) — the keyboard analog of the
        // frontmost chip.
        const field = nextTriggerField(isClaimed);
        if (!field) return;
        e.preventDefault();
        tabUndoRef.current = { raw: entry.raw, caret: entry.raw.length };
        insertTrigger(TRIGGER_WORD[field]);
        return;
      }
      case "Enter":
        if (e.shiftKey) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/⌘+Enter always commits to the queue (overrides highlight).
          entry.submitToQueue(e);
        } else if (
          entry.selectedResult > 0 &&
          entry.selectedResult <= flatCount
        ) {
          // Promote the highlighted result instead of committing.
          entry.selectMatch(search.flat[entry.selectedResult - 1]);
        } else {
          formRef.current?.requestSubmit();
        }
        return;
      case "Escape":
        // Rung 1: a visible ghost is dismissed first.
        if (ghostSuffix) {
          entry.dismissGhost(activeField, activeValue);
          e.preventDefault();
          return;
        }
        if (entry.handleEscape()) e.preventDefault();
        return;
    }
  };

  // Open once there is something to show or react to: a typed query (results or
  // the "log as typed" hint) or a promoted match.
  const panelOpen =
    Boolean(searchOpen && anchorEl) &&
    (entry.raw.trim() !== "" || Boolean(search.selectedMatch));

  return (
    <>
      <Sheet
        ref={setAnchorEl}
        variant="outlined"
        data-testid="flowsheet-smart-entry"
        sx={{
          borderRadius: "md",
          overflow: "hidden",
          // The parent (<Main/>) is a fixed-height (100dvh) flex column with
          // overflow:hidden. Without this the Sheet is a shrinkable flex item,
          // so when the column runs short on space it gets compressed below its
          // content height and — because of the overflow:hidden above (needed
          // for the rounded corners) — clips the filter row at the bottom. Pin
          // it to its natural height; the scroller below absorbs the overflow.
          flexShrink: 0,
          bgcolor: "background.level1",
          borderColor: activeBorder,
          transition: "border-color 0.15s",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          // While the panel is open, square the bottom and hide the border line
          // between the shell and the panel so the active outline flows down
          // into the results box as one continuous shape.
          ...(panelOpen
            ? {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderBottomColor: "transparent",
              }
            : {}),
        }}
      >
        <form ref={formRef} onSubmit={(e) => entry.submit(e)}>
          {/* Hidden submit control so form.requestSubmit() works and the visible
              Play button stays type=button (avoids the logout-form e2e locator
              clash fixed in dbcbf940). */}
          <button
            type="submit"
            aria-hidden
            tabIndex={-1}
            style={{ display: "none" }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.5,
              px: 0.75,
              py: 0.5,
            }}
          >
            <SmartComposer
              raw={entry.raw}
              spans={entry.spans}
              pendingTrigger={entry.pendingTrigger}
              ghostSuffix={ghostSuffix}
              onChange={handleRawChange}
              onKeyDown={onKeyDown}
              onAcceptGhost={() => {
                const full = ghost.acceptGhostText();
                if (full) entry.acceptGhost(ghost.ghostSuffix, activeField, full);
              }}
              onBackspaceAtEnd={handleBackspaceAtEnd}
              onFocus={() => {
                setFocused(true);
                // Refocusing after a click-away should bring the results back
                // (the draft sentence is still there until committed/cleared).
                dispatch(flowsheetSlice.actions.setSearchOpen(true));
              }}
              onBlur={() => setFocused(false)}
              inputRef={inputRef}
              disabled={!live}
              expanded={panelOpen}
              // Inline field-mode chips floated at the caret while composing:
              // splice by/from/via for artist/album/label — the old multi-field
              // affordance on one line.
              caretAffordance={
                focused && live && isComposing ? (
                  <TriggerChips isClaimed={isClaimed} onInsert={insertTrigger} />
                ) : undefined
              }
            />

            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ alignSelf: "center", flexShrink: 0, pr: 0.25 }}
            >
              {isComposing ? (
                // Composing an entry → the commit actions (+ a clear button).
                // Breakpoint/talkset are hidden; they don't apply mid-entry.
                <>
                  <Tooltip title="Clear entry" size="sm">
                    <IconButton
                      type="button"
                      variant="plain"
                      color="neutral"
                      size="sm"
                      aria-label="Clear entry"
                      onClick={() => {
                        entry.reset();
                        inputRef.current?.focus();
                      }}
                    >
                      <Close />
                    </IconButton>
                  </Tooltip>

                  <Divider orientation="vertical" sx={{ mx: 0.25, my: 0.5 }} />

                  <Tooltip title="Add to queue (Ctrl+Enter)" size="sm">
                    <IconButton
                      type="button"
                      variant="soft"
                      color="success"
                      size="sm"
                      aria-label="Add to queue"
                      disabled={!live}
                      onClick={(e) => entry.submitToQueue(e)}
                    >
                      <QueueMusic />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Play now (Enter)" size="sm">
                    <IconButton
                      type="button"
                      variant="solid"
                      color="primary"
                      size="sm"
                      aria-label="Play now"
                      disabled={!live}
                      onClick={() => formRef.current?.requestSubmit()}
                    >
                      <PlayArrow />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                // Idle → the entry-marker buttons; nothing to commit yet.
                <>
                  <BreakpointButton />
                  <TalksetButton />
                </>
              )}
            </Stack>
          </Box>

          <Divider />

          <SmartToolbar />
        </form>
      </Sheet>

      <Popper
        open={panelOpen}
        anchorEl={anchorEl}
        placement="bottom-start"
        transition
        // Sit flush below the shell (which hides its bottom border) so the two
        // read as one continuous outlined shape.
        modifiers={[sameWidth, { name: "offset", options: { offset: [0, 0] } }]}
        style={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Transition
            {...TransitionProps}
            nodeRef={panelRef}
            appear
            timeout={prefersReducedMotion ? 0 : 180}
          >
            {(status) => (
            <Box
              ref={panelRef}
              // CSS-only enter/exit — MUI Material transitions (Grow) crash
              // here because the app provides a Joy theme with no
              // theme.transitions. Scale + fade from the top edge.
              sx={{
                transformOrigin: "top center",
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 180ms ease, transform 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: status === "entering" || status === "entered" ? 1 : 0,
                transform:
                  status === "entering" || status === "entered"
                    ? "scaleY(1)"
                    : "scaleY(0.97)",
              }}
            >
              <ClickAwayListener
                onClickAway={(event) => {
                  // Ignore clicks inside the composer shell — otherwise the very
                  // click that refocuses the composer (and reopens the panel) is
                  // caught by the just-mounted listener as a click-away.
                  if (anchorEl && anchorEl.contains(event.target as Node)) return;
                  dispatch(flowsheetSlice.actions.setSearchOpen(false));
                }}
              >
                <Sheet
                  variant="outlined"
                  sx={(theme) => ({
                    // Square top + no top border continues the shell's squared
                    // bottom; round the bottom to match the search box top.
                    // (Corner radius props don't map theme tokens — use the var.)
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    borderBottomLeftRadius: theme.vars.radius.md,
                    borderBottomRightRadius: theme.vars.radius.md,
                    borderTop: "none",
                    borderColor: activeBorder,
                    transition: "border-color 0.15s",
                    "@media (prefers-reduced-motion: reduce)": {
                      transition: "none",
                    },
                    boxShadow: "lg",
                    maxHeight: "min(70vh, 460px)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  })}
                >
                  <SmartResults
                    selectedMatch={search.selectedMatch}
                    groups={search.groups}
                    fieldOrder={entry.fieldOrder}
                    query={searchQuery}
                    highlightIndex={entry.selectedResult}
                    onSelect={entry.selectMatch}
                    onHover={entry.setHighlight}
                    onRemoveMatch={entry.removeMatch}
                    onPickTrack={entry.pickTrack}
                    emptyHint={
                      <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        No matches — press Enter to log it as typed.
                      </Typography>
                    }
                  />
                </Sheet>
              </ClickAwayListener>
            </Box>
            )}
          </Transition>
        )}
      </Popper>
    </>
  );
}
