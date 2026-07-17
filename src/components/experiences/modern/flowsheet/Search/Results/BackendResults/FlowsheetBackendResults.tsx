import { AlbumEntry } from "@/lib/features/catalog/types";
import { Box, Stack, Typography } from "@mui/joy";
import {
  ENTRY_BAR_CELL_PADDING_X,
  ENTRY_BAR_GRID_TEMPLATE,
} from "../../entryBarStyles";
import FlowsheetBackendResult from "./FlowsheetBackendResult";

const HEADER_CELLS = ["ARTIST", "SONG", "ALBUM", "LABEL"] as const;

// Hard cap on rendered rows PER SECTION. A misbehaving backend (e.g. an
// uncapped "Various Artists" response — see BS#1162 / dj-site#657) can return
// thousands of rows; rendering them all pins the main thread and eventually
// freezes the tab. This cap is intentionally colocated with the render (not a
// distant util) so PR #830's rewrite of this component can't silently drop it.
//
// Accepted ceiling: 4 sections (bin / rotation / catalog / lml) × 50 = 200
// rendered rows max by design.
//
// Exported because keyboard navigation and the index→submission mapping must
// share this cap: the selectedResult index space (FlowsheetSearchbar's nav
// bound, FlowsheetSearchResults' section offsets, and the capped
// allSearchResults in useFlowsheetSearch / useFlowsheetSubmit) is built from
// the same capped section lengths, so VISIBLE === NAVIGABLE — arrow-keying can
// never select (and Enter can never submit) a row this cap hid.
export const MAX_VISIBLE_RESULTS = 50;

export default function FlowsheetBackendResults({
  results,
  offset,
  label,
}: {
  results: AlbumEntry[];
  offset: number;
  label: string;
}) {
  const truncated = results.length > MAX_VISIBLE_RESULTS;
  const visibleResults = truncated
    ? results.slice(0, MAX_VISIBLE_RESULTS)
    : results;

  return (
    <>
      <Box
        sx={{
          visibility: results.length > 0 ? "inherit" : "hidden",
          p: results.length > 0 ? 1 : 0,
          height: results.length > 0 ? "auto" : 0,
        }}
      >
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {label.toUpperCase()}
        </Typography>
      </Box>
      {results.length > 0 && (
        // One table-style header per section, on the entry bar's column
        // template — replaces the per-row field captions
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: ENTRY_BAR_GRID_TEMPLATE,
            pb: 0.25,
          }}
        >
          <Typography
            level="body-xs"
            sx={{
              display: { xs: "none", sm: "block" },
              color: "text.tertiary",
              textAlign: "center",
            }}
          >
            CODE
          </Typography>
          {HEADER_CELLS.map((cell) => (
            <Typography
              key={cell}
              level="body-xs"
              sx={{
                color: "text.tertiary",
                minWidth: 0,
                px: ENTRY_BAR_CELL_PADDING_X,
              }}
            >
              {cell}
            </Typography>
          ))}
          <Box />
        </Box>
      )}
      <Stack
        direction="column"
        data-testid={`flowsheet-results-section-${label
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
        sx={{ visibility: results.length > 0 ? "inherit" : "hidden" }}
      >
        {visibleResults.map((entry, index) => (
          <FlowsheetBackendResult
            key={`${label.replace(" ", "-")}-${index}`}
            entry={entry}
            index={index + offset}
          />
        ))}
        {truncated && (
          <Typography
            level="body-xs"
            data-testid="flowsheet-results-truncated"
            sx={{ color: "text.tertiary", p: 1, fontStyle: "italic" }}
          >
            Showing top {MAX_VISIBLE_RESULTS} — refine your search to see more.
          </Typography>
        )}
      </Stack>
    </>
  );
}
