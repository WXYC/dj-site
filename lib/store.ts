import type { Action, ThunkAction } from "@reduxjs/toolkit";
import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { rtkQueryErrorLogger } from "./rtk-query-error-logger";
import { adminApi } from "./features/admin/api";
import { adminSlice } from "./features/admin/frontend";
import { applicationApi } from "./features/application/api";
import { applicationSlice } from "./features/application/frontend";
import { authenticationSlice } from "./features/authentication/frontend";
import { autoDJApi } from "./features/autoDJ/api";
import { binApi } from "./features/bin/api";
import { catalogApi } from "./features/catalog/api";
import { catalogSlice } from "./features/catalog/frontend";
import { experienceApi } from "./features/experiences/api";
import { flowsheetApi } from "./features/flowsheet/api";
import { flowsheetSlice } from "./features/flowsheet/frontend";
import { liveUpdatesListenerMiddleware } from "./features/flowsheet/live-updates-listener";
import { liveUpdatesSlice } from "./features/flowsheet/live-updates-slice";
import { lmlApi } from "./features/lml/api";
import { metadataApi } from "./features/metadata/api";
import { playlistSearchApi } from "./features/playlist-search/api";
import { playlistSearchSlice } from "./features/playlist-search/frontend";
import { rotationApi } from "./features/rotation/api";
import { rotationSlice } from "./features/rotation/frontend";

const rootReducer = combineSlices(
  authenticationSlice,
  applicationSlice,
  applicationApi,
  autoDJApi,
  experienceApi,
  catalogSlice,
  catalogApi,
  binApi,
  flowsheetSlice,
  flowsheetApi,
  liveUpdatesSlice,
  lmlApi,
  metadataApi,
  playlistSearchSlice,
  playlistSearchApi,
  rotationSlice,
  rotationApi,
  adminSlice,
  adminApi
);

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware()
        .prepend(liveUpdatesListenerMiddleware.middleware)
        .concat(rtkQueryErrorLogger)
        .concat(applicationApi.middleware)
        .concat(autoDJApi.middleware)
        .concat(experienceApi.middleware)
        .concat(catalogApi.middleware)
        .concat(binApi.middleware)
        .concat(flowsheetApi.middleware)
        .concat(lmlApi.middleware)
        .concat(metadataApi.middleware)
        .concat(playlistSearchApi.middleware)
        .concat(rotationApi.middleware)
        .concat(adminApi.middleware);
    },
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>;
