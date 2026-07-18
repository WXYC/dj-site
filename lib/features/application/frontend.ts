import { createAppSlice } from "@/lib/createAppSlice";
import { ApplicationFrontendState, AuthStage, DockView, RightbarPanel } from "./types";
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
  dockView: "collapsed",
  dockAlbumId: null,
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
      // Pinning must never hide the card the DJ just asked to keep visible.
      state.dockView = "album";
      state.dockAlbumId = action.payload;
    },
    unpinAlbum: (state, action: PayloadAction<number>) => {
      state.pinnedAlbumIds = state.pinnedAlbumIds.filter(
        (id) => id !== action.payload,
      );
      if (state.dockAlbumId === action.payload) {
        state.dockAlbumId = null;
        if (state.dockView === "album") {
          state.dockView = "collapsed";
        }
      }
      if (state.pinnedAlbumIds.length === 0) {
        state.dockView = "collapsed";
      }
    },
    openDockAlbum: (state, action: PayloadAction<number>) => {
      state.dockView = "album";
      state.dockAlbumId = action.payload;
    },
    setDockView: (state, action: PayloadAction<DockView>) => {
      state.dockView = action.payload;
    },
    reset: () => defaultApplicationFrontendState,
  },
  selectors: {
    getRightbarPanel: (state) => state.rightbar.panel,
    getAuthStage: (state) => state.authFlow.stage,
    getPinnedAlbumIds: (state) => state.pinnedAlbumIds,
    getDockView: (state) => state.dockView,
    getDockAlbumId: (state) => state.dockAlbumId,
  },
});
