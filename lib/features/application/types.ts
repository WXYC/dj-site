import { ExperienceId } from "../experiences/types";

export const defaultApplicationState: ApplicationState = {
    experience: "modern",
    rightBarMini: true,
};

export interface ApplicationState {
    experience: ExperienceId;
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
