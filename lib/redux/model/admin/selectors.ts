/* Instruments */
import { type ReduxState } from "@/lib/redux";


const getAdminLoading = (state: ReduxState) => state.admin.loading;
const getDJs = (state: ReduxState) => state.admin.djs;