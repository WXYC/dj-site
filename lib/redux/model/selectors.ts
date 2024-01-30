/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const getClassicView = (state: ReduxState) => state.application.classicView;
export const getClassicViewAvailable = (state: ReduxState) => state.application.enableClassicView;

export const getPopupState = (state: ReduxState) => state.application.popupOpen;
export const getPopupContent = (state: ReduxState) => state.application.popupContent;

export const getSongCardState = (state: ReduxState) => state.application.songCardOpen;
export const getSongCardContent = (state: ReduxState) => state.application.songCardContent;