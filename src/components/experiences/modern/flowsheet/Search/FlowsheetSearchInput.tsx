"use client";

import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
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

  const displayValue = getDisplayValue(name);

  // Check if field is auto-filled from the selected entry
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
          if (!isAutoFilled) {
            setSearchProperty(name, e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (isAutoFilled && e.key !== "Tab" && e.key !== "Shift" && e.key !== "Enter") {
            e.preventDefault();
            return;
          }
          // Accept ghost text on Tab
          if (e.key === "Tab" && hasGhost && onAcceptGhost) {
            e.preventDefault();
            onAcceptGhost();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        readOnly={isAutoFilled}
        disabled={Boolean(props.disabled)}
        {...props}
        style={{
          ...externalStyle,
          cursor: isAutoFilled ? "not-allowed" : externalStyle?.cursor,
          opacity: isAutoFilled ? 0.6 : externalStyle?.opacity,
          backgroundColor: isAutoFilled
            ? "rgba(0, 0, 0, 0.05)"
            : externalStyle?.backgroundColor,
        }}
      />
    </div>
  );
}
