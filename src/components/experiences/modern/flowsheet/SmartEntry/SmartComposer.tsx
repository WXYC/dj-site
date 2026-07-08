"use client";

import { Box } from "@mui/joy";
import type { KeyboardEvent, Ref } from "react";
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
  inputRef,
  disabled = false,
  expanded = false,
  placeholder = "Start typing…",
}: {
  raw: string;
  spans: FieldSpan[];
  pendingTrigger?: PendingTrigger;
  ghostSuffix?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
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
      />
      <Box
        component="textarea"
        ref={inputRef}
        rows={1}
        value={raw}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Flowsheet entry"
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
        onKeyDown={onKeyDown}
        sx={{
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
          // (the mirror renders the visible, coloured text underneath).
          caretColor: "var(--joy-palette-text-primary, currentColor)",
          overflow: "hidden",
          "&::placeholder": { color: "text.tertiary", opacity: 1 },
          "&::selection": {
            background: "var(--joy-palette-primary-softBg)",
          },
        }}
      />
    </Box>
  );
}
