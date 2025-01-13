import { ColorPaletteProp } from "@mui/joy";

export interface ApplicationState {
    classic: boolean;
    rightbarMode: RightbarModes;
    routeStyle: ColorPaletteProp;
    popups: { [key: string]: PopupState | PopupStateWithPayload };
}


export type WithPayload<T extends any> = { state: T, payload: any };

export enum RightbarModes {
    SONG_CARD = "SONG_CARD",
    EDIT_CATALOG = "EDIT_CATALOG",
    NONE = "NONE",
}

export type PopupState = boolean;
export type PopupStateWithPayload = WithPayload<PopupState>;