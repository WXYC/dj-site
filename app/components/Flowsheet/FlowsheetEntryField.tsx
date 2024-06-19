"use client";

import {
    flowSheetSlice,
    isLive, useSelector
} from "@/lib/redux";
import { DriveFileRenameOutline } from "@mui/icons-material";
import {
    Button,
    IconButton,
    Link,
    Stack,
    Typography
} from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useState } from "react";
import { useDispatch } from "react-redux";


interface FlowsheetEntryFieldProps {
    label: string;
    value: string;
    current: boolean;
    id: number;
    queue: boolean;
    editable?: boolean;
  }

const FlowsheetEntryField = (props: FlowsheetEntryFieldProps) => {
    const dispatch = useDispatch();

    const live = useSelector(isLive);
    const updateQueueEntry = (id: number, field: string, value: string) =>
      dispatch(flowSheetSlice.actions.updateQueueEntry({ id, field, value }));
    const updateEntry = (id: number, field: string, value: string) =>
      dispatch(flowSheetSlice.actions.updateEntry({ id, field, value }));

    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(props.value ?? "");

    const saveAndClose = (e: any) => {
      e.preventDefault();
      setEditing(false);
      setHover(false);
      if (props.queue) {
        updateQueueEntry(props.id, props.label, value);
      } else {
        updateEntry(props.id, props.label, value);
      }
    };

    const [hover, setHover] = useState(false);

    return (
      <Stack direction="column" sx={{ width: "calc(25%)" }}>
        <Typography
          level="body-sm"
          textColor={props.current ? "text.primary" : "text.icon"}
          sx = {{
            mb: -1,
            textTransform: "uppercase"
          }}
        >
          {props.label}
        </Typography>
        {editing ? (
          <ClickAwayListener onClickAway={saveAndClose}>
            <form onSubmit={saveAndClose}>
              <Typography
                textColor={props.current ? "text.primary" : "text.icon"}
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  borderBottom: "1px solid",
                  mb: -1,
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
                    margin: "0"
                  }}
                  placeholder="Enter a value..."
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
            textColor={props.current ? "primary.lightChannel" : "unset"}
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "text",
              minWidth: "10px",
            }}
            endDecorator={(hover && live) ? 
                <Link
                    variant="plain"
                    onClick={() => setEditing(true)}
                    color="neutral"
                    sx = {{
                        color: "text.icon",
                        bgcolor: "transparent",
                        '&:hover': {
                            color: "text.primary",
                            bgcolor: 'transparent'
                        }
                    }}
                >
                    <DriveFileRenameOutline fontSize="small" />
                </Link>
                : null
            }
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {props.value}&nbsp;
          </Typography>
        )}
      </Stack>
    );
  };

export default FlowsheetEntryField;