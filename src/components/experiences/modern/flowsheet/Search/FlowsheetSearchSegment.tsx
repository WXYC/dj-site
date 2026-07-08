"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { Box } from "@mui/joy";
import { InputHTMLAttributes, Ref, useEffect } from "react";
import {
  flowsheetSegmentInputSx,
  flowsheetSegmentSx,
} from "./flowsheetSearchBarStyles";
import { useBufferedSearchProperty } from "./useBufferedSearchProperty";

type FlowsheetSearchSegmentProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "placeholder" | "value" | "onChange" | "onClick"
> & {
  name: FlowsheetSearchProperty;
  label: string;
  ghostSuffix?: string;
  onAcceptGhost?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  onFlush?: () => void;
  registerFlusher?: (flush: () => void) => void;
  searchOpen?: boolean;
  selectedResult?: number;
  displayValueOverride?: string;
};

export default function FlowsheetSearchSegment({
  name,
  label,
  ghostSuffix,
  onAcceptGhost,
  inputRef,
  onFlush,
  registerFlusher,
  searchOpen,
  selectedResult,
  displayValueOverride,
  ...props
}: FlowsheetSearchSegmentProps) {
  const dispatch = useAppDispatch();
  const { getDisplayValue, selectedIndex, selectedEntry } = useFlowsheetSearch();
  const { value, onChange, flush } = useBufferedSearchProperty(name);

  useEffect(() => {
    registerFlusher?.(flush);
  }, [registerFlusher, flush]);

  const displayValue = displayValueOverride ?? getDisplayValue(name);

  let autoFilled = false;
  if (selectedIndex > 0 && name !== "song" && selectedEntry) {
    switch (name) {
      case "artist":
        autoFilled = Boolean(selectedEntry.artist?.name);
        break;
      case "album":
        autoFilled = Boolean(selectedEntry.title);
        break;
      case "label":
        autoFilled = Boolean(selectedEntry.label);
        break;
    }
  }

  const shownValue = autoFilled ? displayValue : value;

  const thawSelection = () => {
    if (!selectedEntry) return;
    dispatch(
      flowsheetSlice.actions.freezeSelectionToQuery({
        artist: selectedEntry.artist?.name ?? "",
        album: selectedEntry.title ?? "",
        label: selectedEntry.label ?? "",
        album_id: selectedEntry.id ?? undefined,
        rotation_id: selectedEntry.rotation_id ?? undefined,
        rotation_bin: selectedEntry.rotation_bin ?? undefined,
      })
    );
  };

  const hasGhost = !autoFilled && Boolean(ghostSuffix);

  return (
    <Box data-autofilled={autoFilled ? "true" : undefined} sx={flowsheetSegmentSx}>
      {hasGhost && (
        <Box
          aria-hidden
          data-testid={`ghost-text-${name}`}
          sx={{
            position: "absolute",
            inset: 0,
            px: 1,
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
            whiteSpace: "pre",
            fontSize: "var(--joy-fontSize-sm)",
            overflow: "hidden",
          }}
        >
          <Box component="span" sx={{ visibility: "hidden" }}>
            {shownValue}
          </Box>
          <Box component="span" sx={{ color: "text.tertiary", opacity: 0.5 }}>
            {ghostSuffix}
          </Box>
        </Box>
      )}
      <Box
        component="input"
        ref={inputRef}
        name={name}
        type="text"
        placeholder={label}
        aria-label={label}
        data-testid={`flowsheet-search-${name}`}
        value={shownValue}
        autoComplete="off"
        role="combobox"
        aria-expanded={searchOpen}
        aria-controls="flowsheet-results-listbox"
        aria-autocomplete="both"
        aria-activedescendant={
          searchOpen && selectedResult !== undefined && selectedResult >= 0
            ? `flowsheet-option-${selectedResult}`
            : undefined
        }
        onChange={(e) => {
          if (autoFilled) thawSelection();
          onChange(e.target.value);
          onFlush?.();
        }}
        onKeyDown={(e) => {
          if (
            (e.key === "ArrowRight" || e.key === "End") &&
            hasGhost &&
            onAcceptGhost
          ) {
            const el = e.currentTarget;
            const caretAtEnd =
              el.selectionStart === el.value.length &&
              el.selectionEnd === el.value.length;
            if (caretAtEnd) {
              e.preventDefault();
              onAcceptGhost();
            }
          }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={Boolean(props.disabled)}
        sx={flowsheetSegmentInputSx}
        {...props}
      />
    </Box>
  );
}
