import { createAppSelector } from "@/lib/hooks";
import { PopupStateWithPayload } from "@/lib/models";
import { RootState } from "@/lib/store";

export const getClassic = (state: RootState) => state.application.classic;
export const getPageStyle = (state: RootState) => state.application.routeStyle;
export const getRightbarMode = (state: RootState) => state.application.rightbarMode;
export const getPopups = (state: RootState) => state.application.popups;

export const getPopupState = (state: RootState, id: string) => getPopups(state)[id];