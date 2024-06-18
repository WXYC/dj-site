/* Instruments */
import { applicationSlice, authenticationSlice } from "./model";

export const reducer = {
  application: applicationSlice.reducer,
  auth: authenticationSlice.reducer,
};
