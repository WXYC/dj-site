import { createAppSlice } from "@/lib/createAppSlice";
import { RightbarMenu } from "./types";

export const defaultApplicationFrontendState = {
  rightbar: {
    mini: false,
    sidebarOpen: false,
    menu: RightbarMenu.BIN,
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
  },
  selectors: {
    getRightbarMini: (state) => state.rightbar.mini,
    getRightbarMenu: (state) => state.rightbar.menu,
  },
});
