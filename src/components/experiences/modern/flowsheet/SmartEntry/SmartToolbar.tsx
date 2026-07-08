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
        pt: 0.5,
        // A little extra on the bottom so the results panel (which drops from
        // the shell's bottom edge) doesn't crowd the buttons/filters.
        pb: 1,
        // No forced minHeight — the dark section takes the natural height of
        // its content (the ~32px buttons) plus this padding. A forced height is
        // what made the row too tall and left a gutter.
        flexWrap: "wrap",
        alignContent: "center",
        rowGap: 0.5,
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
