"use client";

import { KeyboardDoubleArrowRight } from "@mui/icons-material";
import { Box, Divider, IconButton, Tooltip } from "@mui/joy";
import { ReactNode } from "react";
import { DOCK_HEADER_HEIGHT } from "../catalog/album/dock";

/**
 * Header row for docked panels. Collapsing hides the panel back into the
 * rail — it never discards anything, which is why the affordance is a
 * collapse chevron rather than a close X.
 */
export default function DockedPanelHeader({
  onCollapse,
  children,
}: {
  onCollapse: () => void;
  children?: ReactNode;
}) {
  return (
    <>
      <Box
        sx={{
          height: DOCK_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.5,
          px: 1,
          flexShrink: 0,
        }}
      >
        {children}
        <Tooltip variant="outlined" size="sm" title="Collapse to rail">
          <IconButton
            aria-label="Collapse to rail"
            size="sm"
            variant="plain"
            color="neutral"
            onClick={onCollapse}
          >
            <KeyboardDoubleArrowRight />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
    </>
  );
}
