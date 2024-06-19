/* Instruments */
import { counterSlice, flowSheetSlice, authenticationSlice, binSlice, catalogSlice, rotationSlice, applicationSlice, adminSlice, scheduleSlice } from "./model";

export const reducer = {
  application: applicationSlice.reducer,
  counter: counterSlice.reducer,
  auth: authenticationSlice.reducer,
  admin: adminSlice.reducer,
  bin: binSlice.reducer,
  catalog: catalogSlice.reducer,
  flowsheet: flowSheetSlice.reducer,
  rotation: rotationSlice.reducer,
  schedule: scheduleSlice.reducer
};
