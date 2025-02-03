"use client";

import { useWindowSize } from "@/src/hooks/applicationHooks";
import NowPlaying from "@/src/widgets/NowPlaying";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppSelector } from "@/lib/hooks";
import { PlayArrowOutlined } from "@mui/icons-material";
import { Box, Divider, Stack } from "@mui/joy";

export const NowPlayingContent = () => {
  const mini = useAppSelector((state) =>
    applicationSlice.selectors.getRightbarMini(state)
  );

  const size = useWindowSize();

  return (
    <Box
      sx={{
        p: 2,
      }}
    >
      <Stack direction="column" spacing={2}>
        <Stack direction="row">
          <PlayArrowOutlined sx={{ mr: 1, mt: 0.5 }} />
          Playing Now
        </Stack>
        <NowPlaying
          mini={mini || (size.width !== undefined && size.width < 900)}
        />
      </Stack>
    </Box>
  );
};
