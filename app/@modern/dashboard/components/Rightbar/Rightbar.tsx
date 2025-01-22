import RightbarContainer from "./RightbarContainer";
import { NowPlayingContent } from "./RightbarContent";
import RightbarMobileClose from "./RightbarMobileClose";

export default function Rightbar() {
  return (
    <>
      <RightbarMobileClose />
      <RightbarContainer>
        <NowPlayingContent />
      </RightbarContainer>
    </>
  );
}
