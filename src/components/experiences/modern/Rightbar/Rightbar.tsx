"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { RightbarPanel } from "@/lib/features/application/types";
import { parseAlbumIdFromPathname } from "@/lib/features/catalog/albumRoutes";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Divider } from "@mui/joy";
import { usePathname } from "next/navigation";
import DockedAlbumCard from "../catalog/album/DockedAlbumCard";
import {
  ALBUM_DOCK_QUERY,
  DOCK_PANEL_WIDTH,
  HOME_PANEL_WIDTH,
  RIGHTBAR_FOOTER_CLEARANCE,
} from "../catalog/album/dock";
import BinContent from "./Bin/BinContent";
import DockedPanel from "./DockedPanel";
import DockedPanelHeader from "./DockedPanelHeader";
import NowPlayingContent from "./NowPlayingContent";
import PinnedRail from "./PinnedRail";
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
      <Box sx={{ minHeight: `${RIGHTBAR_FOOTER_CLEARANCE}px` }}></Box>
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
  const dispatch = useAppDispatch();
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const railExpanded = useAppSelector(applicationSlice.selectors.getRailExpanded);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);
  const pathname = usePathname();

  // The URL owns which card is open; Redux owns only the pin list. Settings
  // and account-edit panels need the full width, so any open panel suspends
  // rail mode until it closes.
  const railActive = isDesktop && pinnedAlbumIds.length > 0 && panel.type === "default";

  if (!railActive) {
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

  const activeAlbumId = parseAlbumIdFromPathname(pathname);
  const dockedAlbumId =
    activeAlbumId !== null && pinnedAlbumIds.includes(activeAlbumId) ? activeAlbumId : null;

  // One panel slot beside the always-present rail: the home panel wins over
  // the docked card so the dashboard is reachable without closing the card.
  const panelContent = railExpanded ? (
    <>
      <DockedPanelHeader
        onCollapse={() => dispatch(applicationSlice.actions.setRailExpanded(false))}
      />
      <DefaultRightbarContent />
    </>
  ) : dockedAlbumId !== null ? (
    <DockedAlbumCard albumId={dockedAlbumId} />
  ) : null;

  return (
    <>
      <RightbarMobileClose />
      <DockedPanel
        content={panelContent}
        width={railExpanded ? HOME_PANEL_WIDTH : DOCK_PANEL_WIDTH}
      />
      <RightbarContainer variant="rail">
        <PinnedRail activeAlbumId={activeAlbumId} />
      </RightbarContainer>
    </>
  );
}
