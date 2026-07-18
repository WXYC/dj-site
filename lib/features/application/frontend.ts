import { createAppSlice } from "@/lib/createAppSlice";
import { ApplicationFrontendState, AuthStage, RightbarPanel } from "./types";
import { PayloadAction } from "@reduxjs/toolkit";

export const defaultApplicationFrontendState: ApplicationFrontendState = {
  rightbar: {
    sidebarOpen: false,
    panel: { type: "default" },
  },
  authFlow: {
    stage: "otp-email" as AuthStage,
  },
  pinnedAlbumIds: [],
  railExpanded: false,
};

export const applicationSlice = createAppSlice({
  name: "application",
  initialState: defaultApplicationFrontendState,
  reducers: {
    openPanel: (state, action: PayloadAction<RightbarPanel>) => {
      state.rightbar.panel = action.payload;
      state.rightbar.sidebarOpen = true;
    },
    closePanel: (state) => {
      state.rightbar.panel = { type: "default" };
    },
    closeSidebar: (state) => {
      state.rightbar.sidebarOpen = false;
    },
    toggleSidebar: (state) => {
      state.rightbar.sidebarOpen = !state.rightbar.sidebarOpen;
    },
    setAuthStage: (state, action) => {
      state.authFlow.stage = action.payload;
    },
    pinAlbum: (state, action: PayloadAction<number>) => {
      if (!state.pinnedAlbumIds.includes(action.payload)) {
        state.pinnedAlbumIds.push(action.payload);
      }
      // Pinning is the gesture that reveals the rail; never leave the full
      // rightbar covering a card the DJ just asked to keep visible.
      state.railExpanded = false;
    },
    unpinAlbum: (state, action: PayloadAction<number>) => {
      state.pinnedAlbumIds = state.pinnedAlbumIds.filter(
        (id) => id !== action.payload,
      );
      if (state.pinnedAlbumIds.length === 0) {
        state.railExpanded = false;
      }
    },
    setRailExpanded: (state, action: PayloadAction<boolean>) => {
      state.railExpanded = action.payload;
    },
    reset: () => defaultApplicationFrontendState,
  },
  selectors: {
    getRightbarPanel: (state) => state.rightbar.panel,
    getAuthStage: (state) => state.authFlow.stage,
    getPinnedAlbumIds: (state) => state.pinnedAlbumIds,
    getRailExpanded: (state) => state.railExpanded,
  },
});
