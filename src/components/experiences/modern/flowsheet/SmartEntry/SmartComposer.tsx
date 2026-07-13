"use client";

import { Box } from "@mui/joy";
import type { KeyboardEvent, ReactNode, Ref } from "react";
import type { FieldSpan, PendingTrigger } from "./parser/types";
import ComposerMirror from "./ComposerMirror";
import { smartEntryBoxSx, smartEntryTextMetricsSx } from "./smartEntryStyles";

/**
 * The continuous smart-entry input: a real `<textarea>` with transparent text
 * and a visible caret, sitting on top of an exactly-mirrored highlight layer
 * (`ComposerMirror`). Native caret / selection / IME / mobile keyboards / a11y
 * come for free; the mirror only decorates. It auto-grows because the mirror is
 * in-flow and the textarea fills it. Newlines are stripped (Enter commits).
 */
export default function SmartComposer({
  raw,
  spans,
  pendingTrigger,
  ghostSuffix = "",
  onChange,
  onKeyDown,
  onAcceptGhost,
  onBackspaceAtEnd,
  onFocus,
  onBlur,
  inputRef,
  disabled = false,
  expanded = false,
  placeholder = "Start by typing the song name…",
  caretAffordance,
}: {
  raw: string;
  spans: FieldSpan[];
  pendingTrigger?: PendingTrigger;
  ghostSuffix?: string;
  /** Chips floated inline at the end of the text (see ComposerMirror). */
  caretAffordance?: ReactNode;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAcceptGhost?: () => void;
  /** Backspace with the caret at the end and no selection; return true to
   *  consume it (e.g. undoing an autofill in one step). */
  onBackspaceAtEnd?: () => boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  disabled?: boolean;
  expanded?: boolean;
  placeholder?: string;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        cursor: disabled ? "default" : "text",
      }}
    >
      <ComposerMirror
        raw={raw}
        spans={spans}
        pendingTrigger={pendingTrigger}
        ghostSuffix={ghostSuffix}
        caretAffordance={caretAffordance}
      />
      <Box
        component="textarea"
        ref={inputRef}
        rows={1}
        value={raw}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Flowsheet entry"
        data-testid="flowsheet-composer"
        role="combobox"
        aria-expanded={expanded}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) =>
          onChange((e.target as HTMLTextAreaElement).value.replace(/\n/g, ""))
        }
        onKeyDown={(e) => {
          // Accept ghost text on Right Arrow / End when the caret is at the end
          // of the input and a ghost is showing; otherwise let the keys behave
          // natively (caret movement) and bubble to the parent handler.
          const el = e.currentTarget;
          const caretAtEnd =
            el.selectionStart === el.value.length &&
            el.selectionEnd === el.value.length;

          if (
            (e.key === "ArrowRight" || e.key === "End") &&
            ghostSuffix &&
            onAcceptGhost &&
            caretAtEnd
          ) {
            e.preventDefault();
            onAcceptGhost();
            return;
          }

          // Backspace right after an autofill undoes the whole fill in one step
          // (no holding it through a long name).
          if (e.key === "Backspace" && caretAtEnd && onBackspaceAtEnd?.()) {
            e.preventDefault();
            return;
          }

          onKeyDown?.(e);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        sx={(theme) => ({
          ...smartEntryBoxSx,
          ...smartEntryTextMetricsSx,
          position: "absolute",
          inset: 0,
          zIndex: 1,
          width: "100%",
          height: "100%",
          resize: "none",
          outline: "none",
          background: "transparent",
          color: "transparent",
          // Keep the caret visible even though the text itself is transparent
          // (the mirror renders the visible, coloured text underneath). Use the
          // theme var — the app's cssVarPrefix is "wxyc", so a hardcoded
          // --joy-* var never resolves and the caret falls back to transparent.
          caretColor: theme.vars.palette.text.primary,
          overflow: "hidden",
          "&::placeholder": { color: theme.vars.palette.text.tertiary, opacity: 1 },
          // Translucent selection: the highlight sits on the (transparent-text)
          // textarea in front of the mirror, so an opaque colour would hide the
          // coloured text behind it. Alpha lets the mirror text show through.
          "&::selection": {
            background: `rgba(${theme.vars.palette.primary.mainChannel} / 0.32)`,
          },
        })}
      />
    </Box>
  );
}
