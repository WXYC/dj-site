export const defaultApplicationState: ApplicationState = {
  rightBarMini: true,
};

export interface ApplicationState {
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
  CATALOG_EDITOR,
}
