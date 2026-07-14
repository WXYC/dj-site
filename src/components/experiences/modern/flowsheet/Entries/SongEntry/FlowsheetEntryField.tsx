"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheetActions, useShowControl } from "@/src/hooks/flowsheetHooks";
import { toTitleCase } from "@/src/utilities/stringutilities";
import { Box, IconButton, Tooltip, Typography, TypographyProps } from "@mui/joy";
import { CheckRounded, EditOutlined } from "@mui/icons-material";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

// A compact edit/save affordance tucked at the end of the field.
const FIELD_ACTION_SX = {
  flexShrink: 0,
  "--IconButton-size": "20px",
  "--Icon-fontSize": "15px",
} as const;

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
  const dispatch = useAppDispatch();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(entry[name]));

  const canEdit = editable && live;

  useEffect(() => {
    if (!editing) {
      setValue(String(entry[name]));
    }
  }, [entry[name], editing]);

  const { updateFlowsheet } = useFlowsheetActions();

  const saveAndClose = useCallback(
    (e: MouseEvent | TouchEvent | FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setEditing(false);

      if (queue) {
        // Update queue entry in Redux state
        dispatch(flowsheetSlice.actions.updateQueueEntry({
          entry_id: entry.id,
          field: name,
          value: value,
        }));
      } else {
        // Update flowsheet entry via API
        updateFlowsheet({
          entry_id: entry.id,
          data: {
            [name]: value,
          },
        });
      }
    },
    [entry, value, queue, name, dispatch, updateFlowsheet]
  );

  return editing ? (
    <ClickAwayListener onClickAway={saveAndClose}>
      {/* The form must hold the field's flex slot while editing or the
          row layout collapses around it. */}
      <form
        onSubmit={saveAndClose}
        style={{
          minWidth: 0,
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <Typography
          {...props}
          textColor={playing ? "primary.lightChannel" : "neutral.700"}
          sx={{
            ...props.sx,
            flex: "1 1 auto",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderBottom: "1px solid",
          }}
        >
          <input
            type="text"
            autoComplete="off"
            autoFocus
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
        {/* Clicking the check submits the field (same as Enter / click-away). */}
        <Tooltip title="Save" variant="outlined" size="sm">
          <IconButton
            type="submit"
            size="sm"
            variant="plain"
            color="primary"
            aria-label={`Save ${label}`}
            sx={FIELD_ACTION_SX}
          >
            <CheckRounded />
          </IconButton>
        </Tooltip>
      </form>
    </ClickAwayListener>
  ) : (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        minWidth: 0,
        // A dimmed pencil signals the field is editable. Always visible
        // (dimmed) on touch devices that can't hover; on hover devices it
        // reveals on hover.
        ...(canEdit && {
          "& .field-edit-btn": { opacity: 0.45 },
          "@media (hover: hover)": {
            "& .field-edit-btn": {
              opacity: 0,
              transition: "opacity 120ms",
            },
            "&:hover .field-edit-btn, &:focus-within .field-edit-btn": {
              opacity: 0.45,
            },
          },
        }),
      }}
    >
      {/* A real Tooltip (not the native title attr, which browsers surface
          unreliably) so truncated values are always recoverable on hover. */}
      <Tooltip
        title={String(entry[name])}
        variant="outlined"
        size="sm"
        placement="top-start"
        enterDelay={400}
      >
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
            cursor: canEdit ? "text" : "default",
            opacity: String(entry[name]).length > 0 ? 1 : 0.5,
          }}
          onDoubleClick={() => setEditing(canEdit)}
        >
          {String(entry[name]).length > 0
            ? String(entry[name])
            : `${toTitleCase(label)} Unspecified`}
          &nbsp;
        </Typography>
      </Tooltip>
      {canEdit && (
        <Tooltip title={`Edit ${label}`} variant="outlined" size="sm">
          <IconButton
            className="field-edit-btn"
            size="sm"
            variant="plain"
            color="neutral"
            aria-label={`Edit ${label}`}
            onClick={() => setEditing(true)}
            sx={FIELD_ACTION_SX}
          >
            <EditOutlined />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
