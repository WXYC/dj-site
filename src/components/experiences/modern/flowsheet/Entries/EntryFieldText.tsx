"use client";

import { toTitleCase } from "@/src/utilities/stringutilities";
import { Tooltip, Typography, TypographyProps } from "@mui/joy";
import { CSSProperties } from "react";

/**
 * The view-mode presentation of a flowsheet song field: a real Tooltip (not
 * the native title attr, which browsers surface unreliably) so a truncated
 * value is always recoverable on hover, and the Typography it wraps. `cursor`
 * is a prop, not an owned declaration, because it has to sit between
 * `whiteSpace`/`overflow`/`textOverflow` and `opacity` in the `sx` object --
 * Joy's generated class name is a hash of `sx`'s declarations in the order
 * they're written, so moving `cursor` relative to its neighbors would change
 * every live field's class.
 */
export default function EntryFieldText({
  value,
  label,
  cursor,
  onDoubleClick,
  ...props
}: {
  value: string;
  label: string;
  cursor: CSSProperties["cursor"];
  onDoubleClick: () => void;
} & Omit<TypographyProps, "whiteSpace" | "overflow" | "textOverflow" | "onDoubleClick">) {
  return (
    <Tooltip title={value} variant="outlined" size="sm" placement="top-start" enterDelay={400}>
      <Typography
        {...props}
        sx={{
          ...props.sx,
          // The value stretches so the pencil sits at the cell's right edge.
          flex: "1 1 auto",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor,
          opacity: value.length > 0 ? 1 : 0.5,
        }}
        onDoubleClick={onDoubleClick}
      >
        {value.length > 0 ? value : `${toTitleCase(label)} Unspecified`}
        &nbsp;
      </Typography>
    </Tooltip>
  );
}
