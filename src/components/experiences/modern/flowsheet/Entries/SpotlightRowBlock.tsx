"use client";

import { FlowsheetSpotlightEntry } from "@/lib/features/flowsheet/types";
import { whosOnCopy, whosOnRoleText } from "@/lib/features/flowsheet/whos-on-copy";
import { useEntryActions } from "@/src/hooks/entryActions";
import { useLiveStatus } from "@/src/hooks/flowsheetHooks";
import { CheckRounded, EditOutlined } from "@mui/icons-material";
import { IconButton, Input, Stack, Tooltip, Typography } from "@mui/joy";
import { useState, type FormEvent } from "react";
import { ENTRY_TONES } from "@/lib/features/experiences/modern/tokens/roles";

/**
 * A who's-on row's headline and caption, with the name editable in place.
 * The name is public, so the field carries the composer's notice and label.
 * Only `spotlight_name` is ever sent: the role is not editable here.
 */
export default function SpotlightRowBlock({
  entry,
}: {
  entry: FlowsheetSpotlightEntry;
}) {
  const { live } = useLiveStatus();
  const { updateFlowsheet, pastShow } = useEntryActions();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.spotlight_name);

  const canEdit = live || pastShow;
  const caption = whosOnRoleText(entry.spotlight_role);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = value.trim();
    setEditing(false);
    if (name.length > 0 && name !== entry.spotlight_name) {
      updateFlowsheet({ entry_id: entry.id, data: { spotlight_name: name } });
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} style={{ flex: "1 1 auto", minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Input
            size="sm"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            slotProps={{
              input: { "aria-label": whosOnCopy.nameLabel(entry.spotlight_role) },
            }}
            sx={{ flex: "1 1 auto" }}
          />
          <IconButton
            type="submit"
            size="sm"
            variant="plain"
            color="primary"
            aria-label="Save name"
          >
            <CheckRounded />
          </IconButton>
        </Stack>
        <Typography level="body-xs" textColor="text.tertiary">
          {whosOnCopy.publicNotice(entry.spotlight_role)}
        </Typography>
      </form>
    );
  }

  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography level="body-lg" color={ENTRY_TONES.whosOn.color}>
        {entry.spotlight_name}
      </Typography>
      {caption && (
        <Typography textColor="text.tertiary" sx={{ alignSelf: "center" }}>
          {caption}
        </Typography>
      )}
      {canEdit && (
        <Tooltip title="Edit name" variant="outlined" size="sm">
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            aria-label="Edit name"
            onClick={() => {
              setValue(entry.spotlight_name);
              setEditing(true);
            }}
          >
            <EditOutlined />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
