import type {
  Action,
  Middleware,
  MiddlewareAPI,
  ThunkAction,
} from "@reduxjs/toolkit";
import {
  combineSlices,
  configureStore,
  isRejected,
  isRejectedWithValue,
} from "@reduxjs/toolkit";
import { toast } from "sonner";
import { applicationApi } from "./features/application/api";
import { applicationSlice } from "./features/application/slice";
import {
  authenticationApi,
  djRegistryApi,
} from "./features/authentication/api";
import { authenticationSlice } from "./features/authentication/slice";
import { binApi } from "./features/bin/api";
import { catalogApi } from "./features/catalog/api";
import { catalogSlice } from "./features/catalog/slice";
import { flowsheetApi } from "./features/flowsheet/api";

const rootReducer = combineSlices(
  authenticationSlice,
  authenticationApi,
  djRegistryApi,
  applicationSlice,
  applicationApi,
  catalogSlice,
  catalogApi,
  binApi,
  flowsheetApi
);

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware()
        .concat(rtkQueryErrorLogger)
        .concat(authenticationApi.middleware)
        .concat(djRegistryApi.middleware)
        .concat(applicationApi.middleware)
        .concat(catalogApi.middleware)
        .concat(binApi.middleware)
        .concat(flowsheetApi.middleware);
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
    // RTK Query uses `createAsyncThunk` from redux-toolkit under the hood, so we're able to utilize these matchers!
    if (isRejectedWithValue(action)) {
      toast.error(
        (action.payload as { data: { message: string } }).data.message
      );
    }

    return next(action);
  };
