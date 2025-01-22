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
import { applicationApi } from "./features/application/api";
import { authenticationApi } from "./features/authentication/api";
import { authenticationSlice } from "./features/authentication/slice";
import { toast } from "sonner";
import { catalogApi } from "./features/catalog/api";

const rootReducer = combineSlices(
  authenticationSlice,
  authenticationApi,
  applicationApi,
  catalogApi
);

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware()
        .concat(rtkQueryErrorLogger)
        .concat(authenticationApi.middleware)
        .concat(applicationApi.middleware)
        .concat(catalogApi.middleware);
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
      toast.error((action.payload as { data: { message: string } }).data.message);
    }

    return next(action);
  };
