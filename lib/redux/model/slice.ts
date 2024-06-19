import { createSlice } from "@reduxjs/toolkit";
import { ApplicationState } from "./types";

export const initialState: ApplicationState = {
  enableClassicView: true, // set this to false to disable classic view option
  classicView: false,
  popupOpen: false,
  sideBarOpen: false,
};

export const applicationSlice = createSlice({
  name: "application",
  initialState,
  reducers: {
    toggleClassicView: (state) => {
      state.classicView = !state.classicView;
    },
    setClassicView: (state, action) => {
      state.classicView = action.payload;
    },
    openPopup: (state, action) => {
      state.popupContent = action.payload;
      state.popupOpen = true;
    },
    closePopup: (state) => {
      state.popupContent = undefined;
      state.popupOpen = false;
    },
    openSideBar: (state, action) => {
      state.sideBarContent = action.payload;
      state.sideBarOpen = true;
    },
    closeSideBar: (state) => {
      state.sideBarContent = undefined;
      state.sideBarOpen = false;
    },
  },
});
