"use client";

import { IconButton, Stack, Tooltip } from "@mui/joy";
import type { BinEntryAction } from "./useBinEntryActions";

/**
 * Hover-revealed row of icon buttons for a Mail Bin entry, mirroring the card
 * catalog's row actions. The parent row controls visibility via the
 * `bin-row-actions` class (hidden until hover, always shown on touch).
 */
export default function BinEntryActions({
  actions,
  className,
}: {
  actions: BinEntryAction[];
  className?: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.25}
      className={className}
      // Keep row-level handlers (e.g. context menu) from firing on button taps.
      onContextMenu={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map(({ id, label, Icon, color, run }) => (
        <Tooltip key={id} title={label} variant="outlined" size="sm">
          <IconButton
            aria-label={label}
            variant="plain"
            color={color}
            size="sm"
            onClick={run}
          >
            <Icon fontSize="small" />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
