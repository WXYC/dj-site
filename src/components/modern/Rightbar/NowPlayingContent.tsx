import NowPlaying from "@/src/widgets/NowPlaying";
import { PlayArrowOutlined } from "@mui/icons-material";
import RightBarContentContainer from "./RightBarContentContainer";

export default function NowPlayingContent() {
  return (
    <RightBarContentContainer
      label="Now Playing"
      decorator={<PlayArrowOutlined sx={{ mt: 0.5, mr: 1 }} />}
    >
      <NowPlaying mini={false} />
    </RightBarContentContainer>
  );
}
