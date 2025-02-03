import { Box, Divider } from "@mui/joy";
import RightbarContainer from "./RightbarContainer";
import { NowPlayingContent } from "../../NowPlaying/NowPlayingContent";
import RightbarMobileClose from "./RightbarMobileClose";
import BinContent from "./Bin/BinContent";

export default function Rightbar() {
  return (
    <>
      <RightbarMobileClose />
      <RightbarContainer>
        <NowPlayingContent />
        <Divider />
        <BinContent />
        <Divider />
        <Box sx={{ height: "35px" }}></Box>
      </RightbarContainer>
    </>
  );
}
