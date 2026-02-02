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
    authFlow: AuthFlowState;
}

export interface RightbarState {
    mini: boolean;
    sidebarOpen: boolean;
    menu: RightbarMenu;
}

export type AuthStage = "login" | "forgot" | "reset";

export interface AuthFlowState {
    stage: AuthStage;
}

export enum RightbarMenu {
    BIN,
    CATALOG_EDITOR
}
