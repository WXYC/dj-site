
export const defaultApplicationState: ApplicationState = {
    classic: false,
};

export interface ApplicationState {
    classic: boolean;
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