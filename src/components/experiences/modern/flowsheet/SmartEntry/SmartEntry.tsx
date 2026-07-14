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
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import type { Rotation } from "@/lib/features/rotation/types";
import { ROTATION_BIN_LABELS } from "@/src/utilities/modern/rotationBinColors";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useGhostText, type GhostTextField } from "@/src/hooks/useGhostText";
import BreakpointButton from "../Search/BreakpointButton";
import TalksetButton from "../Search/TalksetButton";
import RotationChips from "./RotationChips";
import RotationTag from "./RotationTag";
import ShortcutGuide from "./ShortcutGuide";
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
  TRIGGER_FIELDS,
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

  // Selected-rotation mode: choosing a bin persists (shown as an ✕-able tag by
  // the song) and hands the results pane over to *everything* in that bin, so
  // the DJ works only with rotation entries without typing. `null` = normal
  // smart-entry search.
  const [selectedRotation, setSelectedRotation] = useState<Rotation | null>(
    null
  );
  const filters = useAppSelector(flowsheetSlice.selectors.getSearchFilters);
  const { data: allRotation } = useGetRotationQuery();
  // In rotation mode the entry must be a real rotation album, so the browse list
  // is narrowed to bin entries whose artist/album/label contain what's typed —
  // you pick from these "available options" rather than free-typing values.
  const typedArtist = entry.fields.artist ?? "";
  const typedAlbum = entry.fields.album ?? "";
  const typedLabel = entry.fields.label ?? "";
  const rotationEntries = useMemo(() => {
    if (!selectedRotation) return [];
    const matchId = search.selectedMatch?.id ?? null;
    const has = (canonical: string | undefined, typed: string) =>
      typed.trim() === "" ||
      (canonical ?? "").toLowerCase().includes(typed.trim().toLowerCase());
    return (allRotation ?? []).filter(
      (e) =>
        e.rotation_bin === selectedRotation &&
        e.id !== matchId &&
        has(e.artist?.name, typedArtist) &&
        has(e.title, typedAlbum) &&
        has(e.label, typedLabel)
    );
  }, [
    selectedRotation,
    allRotation,
    search.selectedMatch,
    typedArtist,
    typedAlbum,
    typedLabel,
  ]);

  // The results model the pane renders — the rotation browse while a bin is
  // selected, otherwise the typed-query search. The selected match still shows
  // on top in both.
  const resultsGroups =
    selectedRotation && rotationEntries.length > 0
      ? [
          {
            key: "rotation" as const,
            label: `${ROTATION_BIN_LABELS[selectedRotation]} rotation`,
            entries: rotationEntries,
          },
        ]
      : selectedRotation
        ? []
        : search.groups;
  const resultsFlat = selectedRotation ? rotationEntries : search.flat;
  const resultsSelectedMatch = search.selectedMatch;

  /** Enter selected-rotation mode: mirror the choice into the right-hand
   *  rotation filter and open the browse pane. */
  const selectRotation = (bin: Rotation) => {
    setSelectedRotation(bin);
    dispatch(
      flowsheetSlice.actions.setSearchFilters({ ...filters, rotationTags: [bin] })
    );
    dispatch(flowsheetSlice.actions.setSearchOpen(true));
    inputRef.current?.focus();
  };
  /** Leave selected-rotation mode (the ✕ on the tag / Escape) and clear the
   *  rotation filter it set. */
  const clearRotation = () => {
    setSelectedRotation(null);
    dispatch(
      flowsheetSlice.actions.setSearchFilters({ ...filters, rotationTags: [] })
    );
  };
  /** Select a result — the pick becomes the pending entry. Rotation mode is
   *  kept (the tag stays) so the DJ can keep working within the bin. */
  const selectResult = (album: AlbumEntry) => {
    entry.selectMatch(album);
  };

  // Leaving the composer empty exits selected-rotation mode too: committing
  // (enqueue / play) and the clear ✕ both reset the composer to "", so this
  // covers them (a failed commit keeps the text, so the mode survives). The
  // filter it set is cleared alongside — resetSearch on commit already emptied
  // filters, but a plain delete-to-empty hasn't, so clear it here regardless.
  useEffect(() => {
    if (!selectedRotation || entry.raw.trim() !== "") return;
    setSelectedRotation(null);
    dispatch(
      flowsheetSlice.actions.setSearchFilters({ ...filters, rotationTags: [] })
    );
  }, [selectedRotation, entry.raw, filters, dispatch]);

  // Once song/artist/album/label are all filled there's nothing left to add via
  // the inline chips, so they (including the H/M/L/S buttons) drop away.
  const allFieldsFilled = TRIGGER_FIELDS.every((f) =>
    Boolean(entry.fields[f])
  );
  // Whether any trigger chip is still showing (an unclaimed field) — drives the
  // divider between the trigger chips and the rotation buttons.
  const someTriggerOpen = TRIGGER_FIELDS.some(
    (f) => !entry.fields[f] && entry.pendingTrigger?.field !== f
  );
  // The H/M/L/S buttons drop away once a match is picked (the entry is chosen)
  // or once already in a rotation. The trigger chips for still-missing fields
  // always remain (whenever composing) — so a fresh rotation browse shows the
  // artist/album/label chips to narrow by, and a rotation pick lacking (say) a
  // label still lets you add one via the chip or Tab without clearing it.
  const hasMatch = Boolean(search.selectedMatch);
  const showRotationButtons = !hasMatch && !selectedRotation;
  const showTriggerChips = someTriggerOpen;
  // In rotation mode the entry must be a real rotation album: submission is
  // blocked until a match is picked from the list (free-typed fields alone
  // aren't a valid rotation entry).
  const rotationLocked = selectedRotation !== null && !hasMatch;

  const flatCount = resultsFlat.length;
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

  // What Tab will do next, for the live shortcut hint — always named by the
  // field it moves into ("add album"), whether Tab is cycling a pending trigger
  // to the next field or advancing into the first open one. Once the cycle
  // passes the last field Tab removes the trigger, and everything filled → no
  // hint.
  const tabHint: string | null = (() => {
    const pending = entry.pendingTrigger;
    if (pending && pending.field !== "song") {
      const next = cycleTriggerField(pending.field, (f) =>
        Boolean(entry.fields[f])
      );
      return next ? `add ${next}` : "remove field";
    }
    const next = nextTriggerField(isClaimed);
    return next ? `add ${next}` : null;
  })();

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
        // Enter only ever commits — never promotes a highlighted result. A
        // result is chosen by clicking it, so hovering/arrowing to one and
        // pressing Enter (to submit) can't silently overwrite the typed entry.
        // In rotation mode you must pick a real rotation album first.
        if (rotationLocked) return;
        if (e.ctrlKey || e.metaKey) {
          entry.submitToQueue(e);
        } else {
          formRef.current?.requestSubmit();
        }
        return;
      case "Escape":
        // Rung 0: leave selected-rotation mode first.
        if (selectedRotation) {
          clearRotation();
          e.preventDefault();
          return;
        }
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
  // A selected rotation forces the browse pane open on click (independent of
  // searchOpen, which otherwise only flips true on a keystroke — the cause of
  // the "results don't show until I type a space" bug). Otherwise the pane
  // opens on a typed query or a promoted match while the search is open.
  const panelOpen =
    Boolean(anchorEl) &&
    (selectedRotation !== null ||
      (searchOpen &&
        (entry.raw.trim() !== "" || Boolean(search.selectedMatch))));

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
        <form
          ref={formRef}
          onSubmit={(e) => {
            // In rotation mode a real rotation album must be picked first.
            if (rotationLocked) {
              e.preventDefault();
              return;
            }
            entry.submit(e);
          }}
        >
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
            {/* Selected-rotation tag — sits at the head of the line, next to
                the song; ✕ exits rotation mode. */}
            {selectedRotation ? (
              <Box sx={{ alignSelf: "center", flexShrink: 0 }}>
                <RotationTag bin={selectedRotation} onClear={clearRotation} />
              </Box>
            ) : null}

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
              // Inline affordances floated at the caret while composing: the
              // field-mode chips (splice by/on/via) then, after a gap, the
              // rotation buttons (H/M/L/S). Both drop away once every field is
              // filled or a rotation is selected (the tag by the song replaces
              // them).
              caretAffordance={
                focused &&
                live &&
                isComposing &&
                !allFieldsFilled &&
                (showTriggerChips || showRotationButtons) ? (
                  <Box
                    sx={{ display: "inline-flex", alignItems: "center" }}
                  >
                    {showTriggerChips ? (
                      <TriggerChips
                        isClaimed={isClaimed}
                        onInsert={insertTrigger}
                      />
                    ) : null}
                    {showTriggerChips && showRotationButtons ? (
                      <Box
                        aria-hidden
                        sx={{
                          width: "1px",
                          height: "1rem",
                          bgcolor: "divider",
                          mx: 0.75,
                        }}
                      />
                    ) : null}
                    {showRotationButtons ? (
                      <RotationChips onTakeover={selectRotation} />
                    ) : null}
                  </Box>
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
                        // The overall cancel-search: reset the composer AND drop
                        // rotation-selection mode (reset() already clears the
                        // filters, so just clear the local flag).
                        entry.reset();
                        setSelectedRotation(null);
                        inputRef.current?.focus();
                      }}
                    >
                      <Close />
                    </IconButton>
                  </Tooltip>

                  <Divider orientation="vertical" sx={{ mx: 0.25, my: 0.5 }} />

                  <Tooltip
                    title={
                      rotationLocked
                        ? "Pick a rotation entry to log"
                        : "Add to queue (Ctrl+Enter)"
                    }
                    size="sm"
                  >
                    <IconButton
                      type="button"
                      variant="soft"
                      color="success"
                      size="sm"
                      aria-label="Add to queue"
                      disabled={!live || rotationLocked}
                      onClick={(e) => entry.submitToQueue(e)}
                    >
                      <QueueMusic />
                    </IconButton>
                  </Tooltip>

                  <Tooltip
                    title={
                      rotationLocked
                        ? "Pick a rotation entry to log"
                        : "Play now (Enter)"
                    }
                    size="sm"
                  >
                    <IconButton
                      type="button"
                      variant="solid"
                      color="primary"
                      size="sm"
                      aria-label="Play now"
                      disabled={!live || rotationLocked}
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
                  // Just close the pane — selected-rotation mode persists (it's
                  // dismissed via the tag's ✕), so the tag/filter stay put.
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
                    selectedMatch={resultsSelectedMatch}
                    groups={resultsGroups}
                    fieldOrder={entry.fieldOrder}
                    query={searchQuery}
                    highlightIndex={entry.selectedResult}
                    onSelect={selectResult}
                    onHover={entry.setHighlight}
                    onRemoveMatch={entry.removeMatch}
                    onPickTrack={entry.pickTrack}
                    emptyHint={
                      <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {selectedRotation
                          ? `Nothing in ${ROTATION_BIN_LABELS[selectedRotation]} rotation right now.`
                          : "No matches — press Enter to log it as typed."}
                      </Typography>
                    }
                  />
                  <ShortcutGuide
                    tabHint={tabHint}
                    ghostActive={Boolean(ghostSuffix)}
                    showResultsNav={flatCount > 0}
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
