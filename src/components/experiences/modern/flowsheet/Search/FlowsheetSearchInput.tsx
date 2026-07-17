"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { toTitleCase } from "@/src/utilities/stringutilities";
import { InputHTMLAttributes, Ref } from "react";
import { ENTRY_BAR_CELL_PADDING_X } from "./entryBarStyles";

type FlowsheetSearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "placeholder" | "value" | "onChange" | "onClick"
> & {
  name: FlowsheetSearchProperty;
  value: string;
  // True when the shown value comes from a highlighted result, not the query
  isAutoFilled?: boolean;
  // Freeze the highlighted result into the query before applying an edit
  onThaw?: () => void;
  ghostSuffix?: string;
  onAcceptGhost?: () => void;
  inputRef?: Ref<HTMLInputElement>;
};

export default function FlowsheetSearchInput({
  name,
  value,
  isAutoFilled = false,
  onThaw,
  style: externalStyle,
  ghostSuffix,
  onAcceptGhost,
  inputRef,
  ...props
}: FlowsheetSearchInputProps) {
  const dispatch = useAppDispatch();

  const hasGhost = !isAutoFilled && Boolean(ghostSuffix);

  return (
    <div
      className="entry-field-cell"
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
            // Must equal the input's own padding or the ghost drifts off the
            // end of the typed text ("inherit" reads the unpadded wrapper)
            paddingInline: ENTRY_BAR_CELL_PADDING_X,
            overflow: "hidden",
          }}
        >
          <span style={{ visibility: "hidden" }}>{value}</span>
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
        value={value}
        autoComplete="off"
        onChange={(e) => {
          if (isAutoFilled) {
            onThaw?.();
          }
          dispatch(
            flowsheetSlice.actions.setSearchProperty({
              name,
              value: e.target.value,
            })
          );
        }}
        onKeyDown={(e) => {
          // Tab is field navigation only — accepting is ArrowRight's job
          if (!hasGhost || !onAcceptGhost) return;
          if (e.key === "ArrowRight" || e.key === "End") {
            const el = e.currentTarget;
            const atEnd =
              el.selectionStart === el.value.length &&
              el.selectionEnd === el.value.length;
            if (atEnd) {
              e.preventDefault();
              onAcceptGhost();
            }
          }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={Boolean(props.disabled)}
        {...props}
        style={{ paddingInline: ENTRY_BAR_CELL_PADDING_X, ...externalStyle }}
      />
    </div>
  );
}
