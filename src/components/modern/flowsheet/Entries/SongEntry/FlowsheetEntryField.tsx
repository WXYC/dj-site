"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheet, useShowControl } from "@/src/hooks/flowsheetHooks";
import { toTitleCase } from "@/src/utilities/stringutilities";
import { Typography, TypographyProps } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import React, { useCallback, useState } from "react";

export default function FlowsheetEntryField({
  entry,
  name,
  label,
  queue,
  playing,
  editable,
  ...props
}: {
  entry: FlowsheetSongEntry;
  name: keyof FlowsheetSongEntry;
  label: string;
  queue: boolean;
  playing: boolean;
  editable: boolean;
} & Omit<TypographyProps, "whiteSpace" | "overflow" | "textOverflow">) {
  const { live } = useShowControl();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(entry[name]));

  const { updateFlowsheet } = useFlowsheet();

  const saveAndClose = useCallback(
    (e: MouseEvent | TouchEvent | React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setEditing(false);

      updateFlowsheet({
        entry_id: entry.id,
        data: {
          [name]: value,
        },
      });
    },
    [entry, value]
  );

  return editing ? (
    <ClickAwayListener onClickAway={saveAndClose}>
      <form onSubmit={saveAndClose}>
        <Typography
          {...props}
          textColor={playing ? "primary.lightChannel" : "neutral.700"}
          sx={{
            ...props.sx,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderBottom: "1px solid",
          }}
        >
          <input
            type="text"
            autoComplete="off"
            style={{
              color: "inherit",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: "inherit",
              background: "transparent",
              width: "100%",
              border: "none",
              outline: "none",
              padding: "0",
              margin: "0",
            }}
            onChange={(e) => {
              setValue(e.target.value);
            }}
            value={value}
          />
        </Typography>
      </form>
    </ClickAwayListener>
  ) : (
    <Typography
      {...props}
      sx={{
        ...props.sx,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "text",
        minWidth: "10px",
        opacity: String(entry[name]).length > 0 ? 1 : 0.5,
      }}
      onDoubleClick={() => setEditing(editable && live)}
    >
      {String(entry[name]).length > 0
        ? String(entry[name])
        : `${toTitleCase(label)} Unspecified`}
      &nbsp;
    </Typography>
  );
}
