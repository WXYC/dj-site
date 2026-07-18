"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { KeyboardDoubleArrowRight } from "@mui/icons-material";
import { Box, IconButton, Tooltip } from "@mui/joy";

/**
 * Shown atop the full rightbar while albums are pinned: collapses the
 * expanded NowPlaying + Bin view back down to the pinned rail.
 */
export default function RailCollapse() {
  const dispatch = useAppDispatch();

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pt: 1 }}>
      <Tooltip variant="outlined" size="sm" title="Collapse to pinned rail">
        <IconButton
          aria-label="Collapse to pinned rail"
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => dispatch(applicationSlice.actions.setRailExpanded(false))}
        >
          <KeyboardDoubleArrowRight />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
