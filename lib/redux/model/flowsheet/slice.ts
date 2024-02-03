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
        setEntryPlaceholderIndex: (state, action) => {
            state.entryPlaceholderIndex = action.payload;
        },
        addToEntries: (state, action) => {
            state.entries.push(action.payload);
            state.editDepth++;
        },
        updateEntry: (state, action) => {

        },
        removeFromEntries: (state, action) => {
            state.entries = state.entries.filter((item) => item.id !== action.payload);
            state.editDepth++;
        },
        setQueuePlaceholderIndex: (state, action) => {
            state.queuePlaceholderIndex = action.payload;
        },
        addToQueue: (state, action) => {
            state.queue.push(action.payload);
        },
        updateQueueEntry: (state, action) => {

        },
        removeFromQueue: (state, action) => {
            state.queue = state.queue.filter((item) => item.id !== action.payload);
        },
        clearQueue: (state) => {
            state.queue = [];
        },
        setEntryClientRect: (state, action) => {
            state.entryClientRect = action.payload;
        },
        switchQueue: (state, action) => {
            const { sourceIndex, destinationIndex } = action.payload;
            const sourceItem = state.queue[sourceIndex];
            state.queue = state.queue.filter((item) => item.id !== sourceItem.id);
            state.queue.splice(destinationIndex, 0, sourceItem);
        },
        switchEntry: (state, action) => {
            const { sourceIndex, destinationIndex } = action.payload;
            const sourceItem = state.entries[sourceIndex];
            state.entries = state.entries.filter((item) => item.id !== sourceItem.id);
            state.entries.splice(destinationIndex, 0, sourceItem);
        },
        playOffTop: (state) => {

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