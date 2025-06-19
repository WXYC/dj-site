
export const defaultApplicationState: ApplicationState = {
    classic: false,
    rightBarMini: true,
};

export interface ApplicationState {
    classic: boolean;
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