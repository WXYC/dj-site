"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Add } from "@mui/icons-material";
import { Stack, Typography } from "@mui/joy";

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

  const summary = [searchQuery.artist, searchQuery.song, searchQuery.album]
    .filter(Boolean)
    .join(" — ");

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      data-testid="flowsheet-new-entry-preview"
      role="option"
      id="flowsheet-option-0"
      aria-selected={selected === 0}
      sx={{
        p: 1,
        cursor: "pointer",
        bgcolor: selected === 0 ? "primary.softBg" : "transparent",
        "&:hover": { bgcolor: "background.level1" },
      }}
      onMouseEnter={() =>
        dispatch(flowsheetSlice.actions.setSelectedResult(0))
      }
    >
      <Add fontSize="small" />
      <Typography level="body-sm" noWrap sx={{ flex: 1 }}>
        New entry: {summary || "…"}
      </Typography>
    </Stack>
  );
}
