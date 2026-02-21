"use client";

import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { toTitleCase } from "@/src/utilities/stringutilities";
import { InputHTMLAttributes } from "react";

export default function FlowsheetSearchInput({
  name,
  style: externalStyle,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "placeholder" | "value" | "onChange" | "onClick"
> & { name: FlowsheetSearchProperty }) {
  const { getDisplayValue, setSearchProperty, selectedIndex, selectedEntry } = useFlowsheetSearch();

  // Get the display value (from selected result or raw query)
  const displayValue = getDisplayValue(name);
  
  // Check if field is auto-filled from the selected entry
  // A field is auto-filled if:
  // 1. We're on a result (selectedIndex > 0)
  // 2. It's not the song field (song is always editable)
  // 3. The selected entry has a value for this field
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

  return (
    <input
      name={name}
      type="text"
      placeholder={toTitleCase(name)}
      value={displayValue}
      autoComplete="off"
      onChange={(e) => {
        // Prevent editing if locked
        if (!isAutoFilled) {
          setSearchProperty(name, e.target.value);
        }
      }}
      onKeyDown={(e) => {
        // Prevent any input when locked
        if (isAutoFilled && e.key !== 'Tab' && e.key !== 'Shift') {
          e.preventDefault();
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
        backgroundColor: isAutoFilled ? "rgba(0, 0, 0, 0.05)" : externalStyle?.backgroundColor,
      }}
    />
  );
}
