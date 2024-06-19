import type { ReduxState } from "@/lib/redux";

export const getBin = (state: ReduxState) => state.bin.bin;
export const isInBin = (state: ReduxState, id: number) => state.bin.bin.some((item) => item.id === id);
