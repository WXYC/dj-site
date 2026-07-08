"use client";

import { Box, Divider, Stack } from "@mui/joy";
import BreakpointButton from "../Search/BreakpointButton";
import TalksetButton from "../Search/TalksetButton";
import ScopeControl from "../Search/ScopeControl";
import SmartFilters from "./SmartFilters";

/**
 * The composer's secondary control row: breakpoint / talkset / scope on the
 * left, then the result filters (genre / format / rotation). The Queue / Play
 * commit buttons live up in the composer row, next to the sentence they commit.
 * Controls wrap on narrow widths.
 */
export default function SmartToolbar({ disabled = false }: { disabled?: boolean }) {
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

      <Divider orientation="vertical" sx={{ alignSelf: "stretch" }} />

      <Box sx={{ flex: 1, minWidth: 160 }}>
        <SmartFilters />
      </Box>
    </Stack>
  );
}
