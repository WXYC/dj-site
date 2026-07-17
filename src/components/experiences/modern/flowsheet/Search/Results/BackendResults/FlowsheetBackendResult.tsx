import { AlbumEntry } from "@/lib/features/catalog/types";
import { entryToFreezePayload } from "@/lib/features/flowsheet/conversions";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useMetadataPrefetch } from "@/lib/features/metadata/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { WXYC_EXCLUSIVE_PURPLE } from "@/src/utilities/modern/brandColors";
import { formatTone } from "@/lib/features/experiences/modern/tokens/roles";
import { Box, Chip, Typography } from "@mui/joy";
import { memo } from "react";
import {
  ENTRY_BAR_CELL_PADDING_X,
  ENTRY_BAR_GRID_TEMPLATE,
} from "../../entryBarStyles";

const cellTextSx = (isSelected: boolean, present: boolean) => ({
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: isSelected ? "white" : present ? "inherit" : "text.tertiary",
  fontStyle: present ? "normal" : "italic",
});

function FlowsheetBackendResult({
  entry,
  index,
}: {
  entry: AlbumEntry;
  index: number;
}) {
  // Boolean subscription: a highlight move re-renders only the two rows
  // whose selected state flipped, not every visible row
  const isSelected = useAppSelector(
    (state) => flowsheetSlice.selectors.getSelectedResult(state) === index
  );
  // Clicked-and-committed: the frozen query carries this row's album id.
  // Editing a filled field deviates (clears the linkage) and unlights it.
  const isCommitted = useAppSelector(
    (state) =>
      entry.id != null &&
      flowsheetSlice.selectors.getSearchQuery(state).album_id === entry.id
  );
  const lit = isSelected || isCommitted;

  const dispatch = useAppDispatch();

  // Warm the tracklist cache so the picker is instantaneous once the result is
  // highlighted (LML's 3-tier cache + BS's 10-minute LRU absorb the actual
  // request). Same pattern as rotation prefetch, but per-row instead of
  // per-bin since search results are heterogeneous.
  const prefetchTracks = useMetadataPrefetch("getLibraryTracks");

  return (
    <Box
      key={`bin-${index}`}
      data-testid={`flowsheet-search-result-${index}`}
      sx={{
        // Rows sit on the entry bar's column template so every value lines
        // up under the field it would fill
        display: "grid",
        gridTemplateColumns: ENTRY_BAR_GRID_TEMPLATE,
        alignItems: "center",
        py: 0.75,
        backgroundColor: lit ? "primary.700" : "transparent",
        cursor: "pointer",
        // Hover is a dim highlight only — committing values to the fields
        // takes a click (or keyboard selection); hovering must never
        // rewrite what the DJ is typing
        "&:hover": {
          backgroundColor: lit ? "primary.700" : "background.level1",
        },
      }}
      onMouseOver={() => {
        if (entry.id) prefetchTracks(entry.id);
      }}
      // Autofill, never submit; prevented mousedown keeps input focus
      onMouseDown={(e) => {
        e.preventDefault();
        dispatch(
          flowsheetSlice.actions.freezeSelectionToQuery(
            entryToFreezePayload(entry)
          )
        );
      }}
    >
      <Typography
        component="div"
        sx={{
          display: { xs: "none", sm: "block" },
          fontFamily: "monospace",
          fontSize: "0.65rem",
          lineHeight: 1.3,
          textAlign: "center",
          overflow: "hidden",
          px: "4px",
          color: lit ? "neutral.300" : "text.tertiary",
        }}
      >
        {entry.artist?.genre} {entry.artist?.lettercode}{" "}
        {entry.artist?.numbercode}/{entry.entry}
      </Typography>
      <Box sx={{ minWidth: 0, px: ENTRY_BAR_CELL_PADDING_X }}>
        <Typography sx={cellTextSx(lit, Boolean(entry.artist?.name))}>
          {entry.artist?.name || "Unknown"}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, px: ENTRY_BAR_CELL_PADDING_X }}>
        <Typography sx={cellTextSx(lit, false)}>Unknown</Typography>
      </Box>
      <Box sx={{ minWidth: 0, px: ENTRY_BAR_CELL_PADDING_X }}>
        <Typography sx={cellTextSx(lit, Boolean(entry.title))}>
          {entry.title || "Unknown"}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, px: ENTRY_BAR_CELL_PADDING_X }}>
        <Typography sx={cellTextSx(lit, Boolean(entry.label))}>
          {entry.label || "Unknown"}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.5,
          pr: 1,
          minWidth: 0,
        }}
      >
        <Chip variant="soft" size="sm" color={formatTone(entry.format).color}>
          {entry.format.includes("vinyl") ? "vinyl" : "cd"}
        </Chip>
        {entry.on_streaming === false && (
          <Chip
            variant="soft"
            size="sm"
            sx={{
              backgroundColor: WXYC_EXCLUSIVE_PURPLE,
              color: "#fff",
              fontWeight: "bold",
              fontSize: "0.6rem",
            }}
          >
            EXCLUSIVE
          </Chip>
        )}
      </Box>
    </Box>
  );
}

export default memo(FlowsheetBackendResult);
