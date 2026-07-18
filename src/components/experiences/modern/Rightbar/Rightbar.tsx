"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { RightbarPanel } from "@/lib/features/application/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Divider } from "@mui/joy";
import DockedAlbumCard from "../catalog/album/DockedAlbumCard";
import { ALBUM_DOCK_QUERY, RIGHTBAR_FOOTER_CLEARANCE } from "../catalog/album/dock";
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
  const dockView = useAppSelector(applicationSlice.selectors.getDockView);
  const dockAlbumId = useAppSelector(applicationSlice.selectors.getDockAlbumId);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);

  // Redux owns the dock entirely (pin list, collapse state, displayed album);
  // the URL owns only the modal card, so opening an unpinned album never
  // touches the dock. Collapse never navigates, and only an explicit rail
  // click or arriving at a pinned album's URL (via the album route child)
  // reopens the dock. Settings and account-edit panels need the full width,
  // so any open panel suspends rail mode until it closes.
  const dockedAlbumId =
    dockAlbumId !== null && pinnedAlbumIds.includes(dockAlbumId) ? dockAlbumId : null;

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

  const panelContent =
    dockView === "home" ? (
      <>
        <DockedPanelHeader
          onCollapse={() => dispatch(applicationSlice.actions.setDockView("collapsed"))}
        />
        <DefaultRightbarContent />
      </>
    ) : dockView === "album" && dockedAlbumId !== null ? (
      <DockedAlbumCard albumId={dockedAlbumId} />
    ) : null;

  return (
    <>
      <RightbarMobileClose />
      <DockedPanel content={panelContent} />
      <RightbarContainer variant="rail">
        <PinnedRail activeAlbumId={dockView === "album" ? dockedAlbumId : null} />
      </RightbarContainer>
    </>
  );
}
