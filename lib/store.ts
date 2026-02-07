import type {
  Action,
  Middleware,
  MiddlewareAPI,
  ThunkAction,
} from "@reduxjs/toolkit";
import {
  combineSlices,
  configureStore,
  isRejectedWithValue,
} from "@reduxjs/toolkit";
import { toast } from "sonner";
import { adminSlice } from "./features/admin/frontend";
import { applicationApi } from "./features/application/api";
import { applicationSlice } from "./features/application/frontend";
import { authenticationSlice } from "./features/authentication/frontend";
import { binApi } from "./features/bin/api";
import { catalogApi } from "./features/catalog/api";
import { catalogSlice } from "./features/catalog/frontend";
import { experienceApi } from "./features/experiences/api";
import { flowsheetApi } from "./features/flowsheet/api";
import { flowsheetSlice } from "./features/flowsheet/frontend";
import { playlistSearchApi } from "./features/playlist-search/api";
import { playlistSearchSlice } from "./features/playlist-search/frontend";
import { rotationApi } from "./features/rotation/api";
import { rotationSlice } from "./features/rotation/frontend";

const rootReducer = combineSlices(
  authenticationSlice,
  applicationSlice,
  applicationApi,
  experienceApi,
  catalogSlice,
  catalogApi,
  binApi,
  flowsheetSlice,
  flowsheetApi,
  playlistSearchSlice,
  playlistSearchApi,
  rotationSlice,
  rotationApi,
  adminSlice
);

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware()
        .concat(rtkQueryErrorLogger)
        .concat(applicationApi.middleware)
        .concat(experienceApi.middleware)
        .concat(catalogApi.middleware)
        .concat(binApi.middleware)
        .concat(flowsheetApi.middleware)
        .concat(playlistSearchApi.middleware)
        .concat(rotationApi.middleware);
    },
  });
};

// Infer the return type of `makeStore`
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `AppDispatch` type from the store itself
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>;

export const rtkQueryErrorLogger: Middleware =
  (api: MiddlewareAPI) => (next) => (action) => {
    if (isRejectedWithValue(action)) {
      const payload = action.payload as {
        data?: { message?: string };
        status?: string;
        error?: string;
      };

      const serverMessage = payload?.data?.message;
      if (serverMessage && serverMessage.trim().length > 0) {
        toast.error(serverMessage);
      } else if (payload?.status === "FETCH_ERROR") {
        toast.error("Network error — please check your connection.");
      } else if (payload?.status === "TIMEOUT_ERROR") {
        toast.error("Request timed out — please try again.");
      } else if (payload?.error && typeof payload.error === "string") {
        toast.error(payload.error);
      }
    }

    return next(action);
  };
