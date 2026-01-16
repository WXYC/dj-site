import { ColorMode, ExperienceId } from "../experiences/types";

export const defaultApplicationState: ApplicationState = {
    experience: "modern",
    colorMode: "light",
    rightBarMini: true,
};

export interface ApplicationState {
    experience: ExperienceId;
    colorMode: ColorMode;
    rightBarMini: boolean;
}

export interface ApplicationFrontendState {
    rightbar: RightbarState;
}

export interface RightbarState {
    mini: boolean;
    sidebarOpen: boolean;
    menu: RightbarMenu;
}

export enum RightbarMenu {
    BIN,
    CATALOG_EDITOR
}
