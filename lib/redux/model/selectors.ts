/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const getClassicView = (state: ReduxState) =>
  state.application.classicView;
export const getClassicViewAvailable = (state: ReduxState) =>
  state.application.enableClassicView;

export const getPopupState = (state: ReduxState) => state.application.popupOpen;
export const getPopupContent = (state: ReduxState) =>
  state.application.popupContent;

export const getSideBarOpen = (state: ReduxState) =>
  state.application.sideBarOpen;
export const getSideBarContent = (state: ReduxState) =>
  state.application.sideBarContent;
