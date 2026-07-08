"use client";

import { PlayArrow, QueueMusic } from "@mui/icons-material";
import { Box, Divider, IconButton, Stack, Tooltip } from "@mui/joy";
import type { MouseEvent } from "react";
import BreakpointButton from "../Search/BreakpointButton";
import TalksetButton from "../Search/TalksetButton";
import ScopeControl from "../Search/ScopeControl";

/**
 * The composer's action row: breakpoint / talkset / scope controls on the left,
 * and the Queue / Play commit buttons on the right (the click + touch commit
 * path; keyboard uses Enter / Ctrl+Enter). Buttons wrap on narrow widths.
 */
export default function SmartToolbar({
  disabled = false,
  onPlay,
  onQueue,
}: {
  disabled?: boolean;
  onPlay: () => void;
  onQueue: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        px: 1,
        py: 0.75,
        minHeight: 44,
        flexWrap: "wrap",
        rowGap: 0.5,
        bgcolor: "background.surface",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <BreakpointButton />
        <TalksetButton />
      </Stack>

      <Divider orientation="vertical" sx={{ alignSelf: "stretch" }} />

      <ScopeControl disabled={disabled} />

      <Box sx={{ flex: 1, minWidth: 8 }} />

      <Stack direction="row" spacing={0.75} alignItems="center">
        <Tooltip title="Add to queue" size="sm">
          <IconButton
            type="button"
            variant="soft"
            color="success"
            size="sm"
            aria-label="Add to queue"
            disabled={disabled}
            onClick={onQueue}
          >
            <QueueMusic />
          </IconButton>
        </Tooltip>

        <Tooltip title="Play now (Enter)" size="sm">
          <IconButton
            type="button"
            variant="solid"
            color="primary"
            size="sm"
            aria-label="Play now"
            disabled={disabled}
            onClick={onPlay}
          >
            <PlayArrow />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
