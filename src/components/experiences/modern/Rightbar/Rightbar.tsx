"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { RightbarPanel } from "@/lib/features/application/types";
import {
  albumParentPath,
  parseAlbumIdFromPathname,
} from "@/lib/features/catalog/albumRoutes";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Divider } from "@mui/joy";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
  const router = useRouter();
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const dockView = useAppSelector(applicationSlice.selectors.getDockView);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);
  const pathname = usePathname();

  // The URL owns which album is open; Redux owns the pin list and the dock's
  // shared collapse state. Settings and account-edit panels need the full
  // width, so any open panel suspends rail mode until it closes.
  const activeAlbumId = parseAlbumIdFromPathname(pathname);
  const dockedAlbumId =
    activeAlbumId !== null && pinnedAlbumIds.includes(activeAlbumId) ? activeAlbumId : null;

  // Landing on a pinned album's URL (rail icon, catalog row, leftbar carry)
  // must surface its docked card even when the dock was collapsed or showing
  // home; the dispatch waits for the navigation so pane switches never pass
  // through a closed state.
  useEffect(() => {
    if (dockedAlbumId !== null) {
      dispatch(applicationSlice.actions.setDockView("album"));
    }
  }, [dockedAlbumId, dispatch]);

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

  const collapseDock = () => {
    dispatch(applicationSlice.actions.setDockView("collapsed"));
    if (activeAlbumId !== null) {
      router.push(albumParentPath(pathname));
    }
  };

  const panelContent =
    dockView === "home" ? (
      <>
        <DockedPanelHeader onCollapse={collapseDock} />
        <DefaultRightbarContent />
      </>
    ) : dockView === "album" && dockedAlbumId !== null ? (
      <DockedAlbumCard albumId={dockedAlbumId} />
    ) : null;

  return (
    <>
      <RightbarMobileClose />
      <DockedPanel
        content={panelContent}
        width={dockView === "home" ? HOME_PANEL_WIDTH : DOCK_PANEL_WIDTH}
      />
      <RightbarContainer variant="rail">
        <PinnedRail activeAlbumId={activeAlbumId} />
      </RightbarContainer>
    </>
  );
}
