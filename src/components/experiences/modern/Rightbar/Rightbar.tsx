"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { RightbarPanel } from "@/lib/features/application/types";
import { parseAlbumIdFromPathname } from "@/lib/features/catalog/albumRoutes";
import { useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Divider } from "@mui/joy";
import { usePathname } from "next/navigation";
import DockedAlbumCard from "../catalog/album/DockedAlbumCard";
import { ALBUM_DOCK_QUERY } from "../catalog/album/dock";
import BinContent from "./Bin/BinContent";
import NowPlayingContent from "./NowPlayingContent";
import PinnedRail from "./PinnedRail";
import RailCollapse from "./RailCollapse";
import RightbarContainer from "./RightbarContainer";
import RightbarMobileClose from "./RightbarMobileClose";
import AccountEditPanel from "./panels/AccountEditPanel";
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
    case "settings":
      return <SettingsPanel />;
    case "account-edit":
      return <AccountEditPanel />;
  }
}

export default function Rightbar() {
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const railExpanded = useAppSelector(applicationSlice.selectors.getRailExpanded);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);
  const pathname = usePathname();

  // The URL owns which card is open; Redux owns only the pin list. Settings
  // and account-edit panels need the full width, so any open panel suspends
  // rail mode until it closes.
  const activeAlbumId = parseAlbumIdFromPathname(pathname);
  const railMode =
    isDesktop && pinnedAlbumIds.length > 0 && !railExpanded && panel.type === "default";
  const dockedAlbumId =
    railMode && activeAlbumId !== null && pinnedAlbumIds.includes(activeAlbumId)
      ? activeAlbumId
      : null;

  return (
    <>
      <RightbarMobileClose />
      {dockedAlbumId !== null && <DockedAlbumCard albumId={dockedAlbumId} />}
      <RightbarContainer variant={railMode ? "rail" : "full"}>
        {railMode ? (
          <PinnedRail activeAlbumId={activeAlbumId} />
        ) : panel.type === "default" ? (
          <>
            {isDesktop && pinnedAlbumIds.length > 0 && <RailCollapse />}
            <DefaultRightbarContent />
          </>
        ) : (
          <RightbarPanelRouter panel={panel} />
        )}
      </RightbarContainer>
    </>
  );
}
