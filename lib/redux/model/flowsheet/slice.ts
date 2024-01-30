import { createSlice } from "@reduxjs/toolkit";
import { FlowSheetState } from "./types";


const initialState: FlowSheetState = {
    live: false,
    flowSheet: [],
    queue: [],
    autoplay: false,
    editDepth: 0,
};

export const flowSheetSlice = createSlice({
    name: "flowSheet",
    initialState,
    reducers: {
        toggleLive: (state) => {
            state.live = !state.live;
        },
        setLive: (state, action) => {
            state.live = action.payload;
        },
        loadFlowSheet: (state, action) => {
            state.flowSheet = action.payload;
        },
        setAutoPlay: (state, action) => {
            state.autoplay = action.payload;
        },
    },
});