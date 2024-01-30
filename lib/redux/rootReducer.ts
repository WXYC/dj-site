/* Instruments */
import { counterSlice, flowSheetSlice, authenticationSlice, binSlice, catalogSlice, rotationSlice, applicationSlice } from "./model";

export const reducer = {
  application: applicationSlice.reducer,
  counter: counterSlice.reducer,
  auth: authenticationSlice.reducer,
  bin: binSlice.reducer,
  catalog: catalogSlice.reducer,
  flowsheet: flowSheetSlice.reducer,
  rotation: rotationSlice.reducer
};
