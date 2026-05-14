"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { toTitleCase } from "@/src/utilities/stringutilities";
import { InputHTMLAttributes, Ref } from "react";

type FlowsheetSearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "placeholder" | "value" | "onChange" | "onClick"
> & {
  name: FlowsheetSearchProperty;
  ghostSuffix?: string;
  onAcceptGhost?: () => void;
  inputRef?: Ref<HTMLInputElement>;
};

export default function FlowsheetSearchInput({
  name,
  style: externalStyle,
  ghostSuffix,
  onAcceptGhost,
  inputRef,
  ...props
}: FlowsheetSearchInputProps) {
  const { getDisplayValue, setSearchProperty, selectedIndex, selectedEntry } =
    useFlowsheetSearch();
  const dispatch = useAppDispatch();

  const displayValue = getDisplayValue(name);

  // Whether this field's value is currently sourced from a selected result.
  let isAutoFilled = false;
  if (selectedIndex > 0 && name !== "song" && selectedEntry) {
    switch (name) {
      case "artist":
        isAutoFilled = Boolean(selectedEntry.artist?.name);
        break;
      case "album":
        isAutoFilled = Boolean(selectedEntry.title);
        break;
      case "label":
        isAutoFilled = Boolean(selectedEntry.label);
        break;
    }
  }

  // Freeze the selected entry's fields into the live query and deselect, so
  // editing one field doesn't blank out the others that came from the result.
  const thawSelection = () => {
    if (!selectedEntry) return;
    dispatch(
      flowsheetSlice.actions.freezeSelectionToQuery({
        artist: selectedEntry.artist?.name ?? "",
        album: selectedEntry.title ?? "",
        label: selectedEntry.label ?? "",
        album_id: selectedEntry.id ?? undefined,
      })
    );
  };

  const hasGhost = !isAutoFilled && Boolean(ghostSuffix);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flex: 1,
        minWidth: 0,
      }}
    >
      {hasGhost && (
        <span
          aria-hidden
          data-testid={`ghost-text-${name}`}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
            whiteSpace: "pre",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            paddingInline: "inherit",
            overflow: "hidden",
          }}
        >
          <span style={{ visibility: "hidden" }}>{displayValue}</span>
          <span style={{ color: "rgba(128, 128, 128, 0.5)" }}>
            {ghostSuffix}
          </span>
        </span>
      )}
      <input
        ref={inputRef}
        name={name}
        type="text"
        data-testid={`flowsheet-search-${name}`}
        placeholder={toTitleCase(name)}
        value={displayValue}
        autoComplete="off"
        onChange={(e) => {
          if (isAutoFilled) {
            thawSelection();
          }
          setSearchProperty(name, e.target.value);
        }}
        onKeyDown={(e) => {
          // Accept ghost text on Tab
          if (e.key === "Tab" && hasGhost && onAcceptGhost) {
            e.preventDefault();
            onAcceptGhost();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={Boolean(props.disabled)}
        {...props}
        style={externalStyle}
      />
    </div>
  );
}
