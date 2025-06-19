"use client";

import { useGetRightbarQuery } from "@/lib/features/application/api";
import NowPlaying from "@/src/widgets/NowPlaying";
import { PlayArrowOutlined } from "@mui/icons-material";
import RightBarContentContainer from "./RightBarContentContainer";
import RightbarMiniSwitcher from "./RightbarMiniSwitcher";

export default function NowPlayingContent() {
  const { data: mini } = useGetRightbarQuery();

  return (
    <RightBarContentContainer
      label="Now Playing"
      startDecorator={<PlayArrowOutlined sx={{ mt: 0.5, mr: 1 }} />}
      endDecorator={<RightbarMiniSwitcher />}
    >
      <NowPlaying mini={mini ?? false} />
    </RightBarContentContainer>
  );
}
