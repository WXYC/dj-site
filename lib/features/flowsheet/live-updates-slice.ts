import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";

export type LiveUpdatesConnectionStatus =
  | "closed"
  | "connecting"
  | "connected"
  | "reconnecting";

export type LiveUpdatesState = {
  connectionStatus: LiveUpdatesConnectionStatus;
  lastEventAt: number | null;
  refCount: number;
};

export const defaultLiveUpdatesState: LiveUpdatesState = {
  connectionStatus: "closed",
  lastEventAt: null,
  refCount: 0,
};

export const liveUpdatesSlice = createAppSlice({
  name: "liveUpdates",
  initialState: defaultLiveUpdatesState,
  reducers: (create) => ({
    liveUpdatesConnectionRequested: create.reducer((state) => {
      state.refCount += 1;
    }),
    liveUpdatesConnectionReleased: create.reducer((state) => {
      state.refCount = Math.max(0, state.refCount - 1);
    }),
    liveUpdatesConnectionStateChanged: create.reducer(
      (state, action: PayloadAction<LiveUpdatesConnectionStatus>) => {
        state.connectionStatus = action.payload;
      }
    ),
    liveUpdatesLastEventAtUpdated: create.reducer(
      (state, action: PayloadAction<number>) => {
        state.lastEventAt = action.payload;
      }
    ),
  }),
  selectors: {
    selectLiveUpdatesConnectionStatus: (state) => state.connectionStatus,
    selectLiveUpdatesIsConnected: (state) =>
      state.connectionStatus === "connected",
    selectLiveUpdatesLastEventAt: (state) => state.lastEventAt,
    selectLiveUpdatesRefCount: (state) => state.refCount,
  },
});

export const {
  liveUpdatesConnectionRequested,
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionStateChanged,
  liveUpdatesLastEventAtUpdated,
} = liveUpdatesSlice.actions;
