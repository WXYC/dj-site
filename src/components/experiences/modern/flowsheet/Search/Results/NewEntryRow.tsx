"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Stack, Typography } from "@mui/joy";

const FIELDS = [
  { key: "artist", label: "ARTIST" },
  { key: "song", label: "SONG" },
  { key: "album", label: "ALBUM" },
  { key: "label", label: "LABEL" },
] as const;

export default function NewEntryRow() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const hasQuery =
    Boolean(searchQuery.artist) ||
    Boolean(searchQuery.song) ||
    Boolean(searchQuery.album) ||
    Boolean(searchQuery.label);

  if (!hasQuery) return null;

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      data-testid="flowsheet-new-entry-preview"
      role="option"
      id="flowsheet-option-0"
      aria-selected={selected === 0}
      sx={{
        p: 1,
        cursor: "pointer",
        backgroundColor: selected === 0 ? "primary.700" : "transparent",
      }}
      onMouseEnter={() =>
        dispatch(flowsheetSlice.actions.setSelectedResult(0))
      }
    >
      {FIELDS.map(({ key, label }) => {
        const value = searchQuery[key] as string;
        return (
          <Stack key={key} direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
            <Typography
              level="body-xs"
              sx={{
                mb: -0.5,
                color: selected === 0 ? "neutral.300" : "text.tertiary",
              }}
            >
              {label}
            </Typography>
            <Typography
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: selected === 0 ? "white" : "inherit",
                fontStyle: value ? "normal" : "italic",
                opacity: value ? 1 : 0.6,
              }}
            >
              {value || "Not specified"}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}
