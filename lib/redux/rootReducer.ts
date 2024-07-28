/* Instruments */
import { adminSlice, applicationSlice, authenticationSlice, catalogSlice } from "./model";

export const reducer = {
  application: applicationSlice.reducer,
  auth: authenticationSlice.reducer,
  catalog: catalogSlice.reducer,
  admin: adminSlice.reducer,
};
