import { Box, Divider } from "@mui/joy";
import BinContent from "./Bin/BinContent";
import RightbarContainer from "./RightbarContainer";
import RightbarMobileClose from "./RightbarMobileClose";
import NowPlayingContent from "./NowPlayingContent";

export default function Rightbar() {
  return (
    <>
      <RightbarMobileClose />
      <RightbarContainer>
        <NowPlayingContent />
        <Divider />
        <BinContent />
        <Divider />
        <Box sx={{ minHeight: "65px" }}></Box>
      </RightbarContainer>
    </>
  );
}
