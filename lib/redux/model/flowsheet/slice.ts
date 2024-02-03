import { createSlice } from "@reduxjs/toolkit";
import { FlowSheetState } from "./types";
import { join, leave } from "./thunks";


const initialState: FlowSheetState = {
    live: false,
    changingAir: false,
    entries: [],
    entryPlaceholderIndex: -1,
    queue: [],
    queuePlaceholderIndex: -1,
    autoplay: false,
    editDepth: 0,
};

export const flowSheetSlice = createSlice({
    name: "flowSheet",
    initialState,
    reducers: {
        loadFlowSheet: (state, action) => {
            state.entries = action.payload;
        },
        setAutoPlay: (state, action) => {
            state.autoplay = action.payload;
        },
        addToEntries: (state, action) => {
            state.entries.push(action.payload);
            state.editDepth++;
        },
        removeFromEntries: (state, action) => {
            state.entries = state.entries.filter((item) => item.id !== action.payload);
            state.editDepth++;
        },
        addToQueue: (state, action) => {
            state.queue.push(action.payload);
        },
        removeFromQueue: (state, action) => {
            state.queue = state.queue.filter((item) => item.id !== action.payload);
        },
        clearQueue: (state) => {
            state.queue = [];
        },
    },
    extraReducers: (builder) => {
        builder
        .addCase(join.pending, (state) => {
            state.changingAir = true;
        })
        .addCase(join.fulfilled, (state, action) => {
            state.changingAir = false;
            state.live = action.payload;
        })
        .addCase(leave.pending, (state) => {
            state.changingAir = true;
        })
        .addCase(leave.fulfilled, (state, action) => {
            state.changingAir = false;
            state.live = !action.payload;
        });
    }
});