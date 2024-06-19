/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const processingLive = (state: ReduxState) => state.flowsheet.changingAir;
export const flowsheetLoading = (state: ReduxState) => state.flowsheet.loading;
export const isLive = (state: ReduxState) => state.flowsheet.live;
export const getQueue = (state: ReduxState) => state.flowsheet.queue.toReversed();
export const getQueuePlaceholderIndex = (state: ReduxState) => state.flowsheet.queuePlaceholderIndex;
export const getEntries = (state: ReduxState) => state.flowsheet.entries;
export const getEntryPlaceholderIndex = (state: ReduxState) => state.flowsheet.entryPlaceholderIndex;
export const getAutoplay = (state: ReduxState) => state.flowsheet.autoplay;
export const getEntryClientRect = (state: ReduxState) => state.flowsheet.entryClientRect;
export const getCurrentlyPlayingSongLength = (state: ReduxState) => state.flowsheet.timer?.length;
export const getCurrentlyPlayingSongRemaining = (state: ReduxState) => state.flowsheet.timer?.remaining;
export const getEditDepth = (state: ReduxState) => state.flowsheet.editDepth;