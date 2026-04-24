"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { RightbarPanel } from "@/lib/features/application/types";
import { useAppSelector } from "@/lib/hooks";
import { Box, Divider } from "@mui/joy";
import BinContent from "./Bin/BinContent";
import NowPlayingContent from "./NowPlayingContent";
import RightbarContainer from "./RightbarContainer";
import RightbarMobileClose from "./RightbarMobileClose";
import AccountEditPanel from "./panels/AccountEditPanel";
import AlbumDetailPanel from "./panels/AlbumDetailPanel";
import SettingsPanel from "./panels/SettingsPanel";

function DefaultRightbarContent() {
  return (
    <>
      <NowPlayingContent />
      <Divider />
      <BinContent />
      <Divider />
      <Box sx={{ minHeight: "65px" }}></Box>
    </>
  );
}

function RightbarPanelRouter({ panel }: { panel: Exclude<RightbarPanel, { type: "default" }> }) {
  switch (panel.type) {
    case "album-detail":
      return <AlbumDetailPanel albumId={panel.albumId} />;
    case "settings":
      return <SettingsPanel />;
    case "account-edit":
      return <AccountEditPanel />;
  }
}

export default function Rightbar() {
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);

  return (
    <>
      <RightbarMobileClose />
      <RightbarContainer>
        {panel.type === "default" ? (
          <DefaultRightbarContent />
        ) : (
          <RightbarPanelRouter panel={panel} />
        )}
      </RightbarContainer>
    </>
  );
}
