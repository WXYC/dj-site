// APP STATE
export interface ApplicationState {
  enableClassicView: boolean;
  classicView: boolean;
  popupContent?: JSX.Element;
  sideBarContent?: JSX.Element;
  sideBarOpen: boolean;
  popupOpen: boolean;
}

export type Tuple<T> = [T, T];
