import type { ReduxState } from "@/lib/redux";

export const isInBin = (state: ReduxState, id: string) => state.bin.bin.includes(id);
