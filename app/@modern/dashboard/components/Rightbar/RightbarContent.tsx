"use client";

import { useWindowSize } from "@/app/hooks/applicationHooks";
import NowPlaying from "@/app/widgets/NowPlaying";
import { applicationSlice } from "@/lib/features/application/slice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PlayArrowOutlined } from "@mui/icons-material";
import { Box, Stack } from "@mui/joy";
import { useEffect } from "react";

export const NowPlayingContent = () => {

  const mini = useAppSelector((state) =>
    applicationSlice.selectors.getRightbarMini(state)
  );

  const size = useWindowSize();

  return (
    <Box
      sx={{
        p: 2,
        py: 3,
      }}
    >
      <Stack direction="column" spacing={2} sx={{ pb: 2 }}>
        <Stack direction="row">
          <PlayArrowOutlined sx={{ mr: 1, mt: 0.5 }} />
          Playing Now
        </Stack>
        <NowPlaying mini={mini || (size.width !== undefined && size.width < 900)} />
      </Stack>
    </Box>
  );
};
