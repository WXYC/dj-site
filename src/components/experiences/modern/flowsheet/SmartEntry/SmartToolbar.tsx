"use client";

import { Box } from "@mui/joy";
import SmartFilters from "./SmartFilters";

/**
 * The composer's secondary row: the result filters (genre / format / rotation).
 * The action buttons — breakpoint / talkset / queue / play — all live up in the
 * composer row now, since they act on the entry, not the filters.
 */
export default function SmartToolbar() {
  return (
    <Box
      sx={{
        // Even padding on all sides; let the filter autocompletes size
        // themselves to their content rather than forcing the row height.
        p: 1,
        bgcolor: "background.surface",
      }}
    >
      <SmartFilters />
    </Box>
  );
}
