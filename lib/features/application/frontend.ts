import { createAppSlice } from "@/lib/createAppSlice";
import { ApplicationFrontendState, AuthStage, RightbarPanel } from "./types";
import { PayloadAction } from "@reduxjs/toolkit";

export const defaultApplicationFrontendState: ApplicationFrontendState = {
  rightbar: {
    mini: false,
    sidebarOpen: false,
    panel: { type: "default" },
  },
  authFlow: {
    stage: "otp-email" as AuthStage,
  },
};

export const applicationSlice = createAppSlice({
  name: "application",
  initialState: defaultApplicationFrontendState,
  reducers: {
    setRightbarMini: (state, action) => {
      state.rightbar.mini = action.payload;
    },
    openPanel: (state, action: PayloadAction<RightbarPanel>) => {
      state.rightbar.panel = action.payload;
      state.rightbar.sidebarOpen = true;
      state.rightbar.mini = false;
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
    reset: () => defaultApplicationFrontendState,
  },
  selectors: {
    getRightbarMini: (state) => state.rightbar.mini,
    getRightbarPanel: (state) => state.rightbar.panel,
    getAuthStage: (state) => state.authFlow.stage,
  },
});
