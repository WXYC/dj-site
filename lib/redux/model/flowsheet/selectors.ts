/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const isLive = (state: ReduxState) => state.flowsheet.live;
export const getFlowSheet = (state: ReduxState) => state.flowsheet;