"use client";

import NowPlaying from "@/src/widgets/NowPlaying";
import { PlayArrowOutlined } from "@mui/icons-material";
import RightBarContentContainer from "./RightBarContentContainer";
import RightbarMiniSwitcher from "./RightbarMiniSwitcher";
import { useAppSelector } from "@/lib/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";

export default function NowPlayingContent() {
  const mini = useAppSelector(applicationSlice.selectors.getRightbarMini);

  return (
    <RightBarContentContainer
      label="Now Playing"
      startDecorator={<PlayArrowOutlined sx={{ mt: 0.5, mr: 1 }} />}
      endDecorator={<RightbarMiniSwitcher />}
    >
      <NowPlaying mini={mini} />
    </RightBarContentContainer>
  );
}
