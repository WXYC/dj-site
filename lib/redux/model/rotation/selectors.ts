/* Instruments */
import type { ReduxState } from "@/lib/redux";


export const getRotation = (state: ReduxState) => state.rotation.entries;
export const getRotationLoading = (state: ReduxState) => state.rotation.loading;

export const getEditedSong = (state: ReduxState) => state.rotation.editedSong;