import { createAppSlice } from "@/lib/createAppSlice";
import { getPreferredLoginMethod } from "./login-method-storage";
import { ApplicationFrontendState, RightbarMenu } from "./types";

export const defaultApplicationFrontendState: ApplicationFrontendState = {
  rightbar: {
    mini: false,
    sidebarOpen: false,
    menu: RightbarMenu.BIN,
  },
  authFlow: {
    stage: getPreferredLoginMethod(),
  },
};

export const applicationSlice = createAppSlice({
  name: "application",
  initialState: defaultApplicationFrontendState,
  reducers: {
    setRightbarMini: (state, action) => {
      state.rightbar.mini = action.payload;
    },
    setRightbarMenu: (state, action) => {
      state.rightbar.menu = action.payload;
      state.rightbar.mini = action.payload === RightbarMenu.CATALOG_EDITOR;
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
    getRightbarMenu: (state) => state.rightbar.menu,
    getAuthStage: (state) => state.authFlow.stage,
  },
});
