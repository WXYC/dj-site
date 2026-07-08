"use client";

import { Box, Divider, Stack } from "@mui/joy";
import BreakpointButton from "../Search/BreakpointButton";
import TalksetButton from "../Search/TalksetButton";
import SmartFilters from "./SmartFilters";

/**
 * The composer's secondary control row: result filters on the left, and the
 * breakpoint / talkset buttons on the far right (beneath the Play/Queue buttons
 * in the composer row). The rotation scope toggle is gone — the rotation-bin
 * filter covers it. Controls wrap on narrow widths.
 */
export default function SmartToolbar() {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        px: 1,
        py: 1,
        minHeight: 52,
        flexWrap: "wrap",
        // Center the row(s) vertically — without this a wrap container leaves a
        // gutter above and pushes the controls to the bottom.
        alignContent: "center",
        rowGap: 1,
        bgcolor: "background.surface",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 180 }}>
        <SmartFilters />
      </Box>

      <Divider orientation="vertical" sx={{ alignSelf: "stretch" }} />

      <Stack direction="row" spacing={0.5} alignItems="center">
        <BreakpointButton />
        <TalksetButton />
      </Stack>
    </Stack>
  );
}
