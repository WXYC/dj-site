"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { Stack, Typography } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import React, { useState } from "react";

export default function FlowsheetEntryField({
  entry,
  name,
  label,
  queue,
  playing,
  editable,
}: {
  entry: FlowsheetSongEntry;
  name: keyof FlowsheetSongEntry;
  label: string;
  queue: boolean;
  playing: boolean;
  editable: boolean;
}) {
  const { live } = useShowControl();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(entry[name]) ?? "");

  const saveAndClose = (
    e: MouseEvent | TouchEvent | React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setEditing(false);
  };

  return (
    <Stack direction="column" sx={{ width: "calc(25%)" }}>
      <Typography
        level="body-xs"
        sx={{ mb: -1 }}
        textColor={playing ? "primary.300" : "neutral.600"}
      >
        {label.toUpperCase()}
      </Typography>
      {editing ? (
        <ClickAwayListener onClickAway={saveAndClose}>
          <form onSubmit={saveAndClose}>
            <Typography
              textColor={playing ? "primary.lightChannel" : "neutral.700"}
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                borderBottom: "1px solid",
              }}
            >
              <input
                type="text"
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
                defaultValue={String(entry[name])}
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
          textColor={playing ? "primary.lightChannel" : "unset"}
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "text",
            minWidth: "10px",
          }}
          onDoubleClick={() => setEditing(editable && live)}
        >
          {String(entry[name])}&nbsp;
        </Typography>
      )}
    </Stack>
  );
}
