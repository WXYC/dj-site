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
        px: 1,
        pt: 0.5,
        // A little extra on the bottom so the results panel (which drops from
        // the shell's bottom edge) doesn't crowd the filters.
        pb: 1.5,
        bgcolor: "background.surface",
      }}
    >
      <SmartFilters />
    </Box>
  );
}
