import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { rtkQueryErrorLogger } from "./rtk-query-error-logger";
import { applicationSlice } from "./features/application/frontend";
import { authenticationSlice } from "./features/authentication/frontend";
import { experienceApi } from "./features/experiences/api";
import { flowsheetApi } from "./features/flowsheet/api";
import { flowsheetSlice } from "./features/flowsheet/frontend";
import { liveUpdatesListenerMiddleware } from "./features/flowsheet/live-updates-listener";
import { liveUpdatesSlice } from "./features/flowsheet/live-updates-slice";
import { playlistSearchApi } from "./features/playlist-search/api";
import { playlistSearchSlice } from "./features/playlist-search/frontend";

// Store for routes rendered outside the authenticated dashboard: the home,
// login, public live view, and playlist archive, plus the always-mounted shell
// (theme controls persist a preference through experienceApi). It combines
// only the slices those surfaces touch, so the DJ-facing feature graph
// (admin roster, catalog, rotation, autoDJ, bin, metadata, LML) never enters a
// public route's client bundle. The dashboard mounts its own superset store.
//
// Every reducer here is a strict subset of the full store's, so components
// keep using the full-store-typed hooks; a public surface only ever reads
// selectors present in both.
const publicRootReducer = combineSlices(
  authenticationSlice,
  applicationSlice,
  experienceApi,
  flowsheetSlice,
  flowsheetApi,
  liveUpdatesSlice,
  playlistSearchSlice,
  playlistSearchApi
);

export const makePublicStore = () => {
  return configureStore({
    reducer: publicRootReducer,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware()
        .prepend(liveUpdatesListenerMiddleware.middleware)
        .concat(rtkQueryErrorLogger)
        .concat(experienceApi.middleware)
        .concat(flowsheetApi.middleware)
        .concat(playlistSearchApi.middleware);
    },
  });
};

export type PublicAppStore = ReturnType<typeof makePublicStore>;
