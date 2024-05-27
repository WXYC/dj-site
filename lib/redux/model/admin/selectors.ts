/* Instruments */
import { type ReduxState } from "@/lib/redux";


export const getAdminLoading = (state: ReduxState) => state.admin.loading;
export const getAdminError = (state: ReduxState) => state.admin.error;
export const getDJs = (state: ReduxState) => state.admin.djs;