import { createSlice } from "@reduxjs/toolkit";
import { FlowSheetEntry, FlowSheetState } from "./types";
import { getIsLive, join, leave, loadFlowsheet, loadFlowsheetEntries, pushToEntries } from "./thunks";
import { toast } from "sonner";
import { CatalogResult } from "../catalog";
import { convertCatalogToFlowsheet } from "../..";
import { cp } from "fs";
import { current } from '@reduxjs/toolkit';

const initialState: FlowSheetState = {
    live: false,
    changingAir: false,
    loading: false,
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
        setAutoPlay: (state, action) => {
            state.autoplay = action.payload;
        },
        setEntryPlaceholderIndex: (state, action) => {
            state.entryPlaceholderIndex = action.payload;
            console.log(`Setting entry placeholder index to ${action.payload}`);
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
            state.queue.push({
                ...convertCatalogToFlowsheet(action.payload),
                id: state.queue.length + 1
            });
        },
        updateQueueEntry: (state, action) => {
            const { id, field, value } = action.payload;
            const match = state.queue.find((item) => item.id === id);
            if (match)
            {
                const entry: FlowSheetEntry = { ...match };
                switch (field) {
                    case "song":
                        entry.song!.title = value;
                        break;
                    case "artist":
                        if (value !== entry.song!.album!.artist.name)
                        {
                            entry.catalog_id = undefined;
                        }
                        entry.song!.album!.artist.name = value;
                        break;
                    case "album":
                        if (value !== entry.song!.album!.title)
                        {
                            entry.catalog_id = undefined;
                        }
                        entry.song!.album!.title = value;
                        break;
                    case "label":
                        if (value !== entry.song!.album!.label)
                        {
                            entry.catalog_id = undefined;
                        }
                        entry.song!.album!.label = value;
                        break;
                    default:
                        break;
                }

                state.queue = state.queue.map((item) => item.id === id ? entry : item);
            }
        },
        removeCatalogEntryFromQueue: (state, action) => {
            state.queue = state.queue.filter((item: FlowSheetEntry) => item.catalog_id !== action.payload);
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
            console.log(action.payload);
            const { from, to } = action.payload;
            console.table(current(state.queue));
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
        .addCase(loadFlowsheet.pending, (state) => {
            state.loading = true;
        })
        .addCase(loadFlowsheet.fulfilled, (state, action) => {
            state.loading = false;
            state.entries = action.payload;
            state.editDepth = 0;
        })
        .addCase(loadFlowsheet.rejected, (state) => {
            state.loading = false;
        })
        .addCase(getIsLive.pending, (state) => {
            state.changingAir = true;
        })
        .addCase(getIsLive.fulfilled, (state, action) => {
            state.changingAir = false;
            state.live = action.payload;
            if (action.payload) {
                toast.success("You are live!");
            } else {
                toast.info("You are not live.");
            }
        })
        .addCase(getIsLive.rejected, (state) => {
            state.changingAir = false;
            state.live = false;
        })
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
        })
        .addCase(loadFlowsheetEntries.pending, (state) => {
            state.loading = true;
        })
        .addCase(loadFlowsheetEntries.fulfilled, (state, action) => {
            state.loading = false;
            const numberUpdated = action.payload.length;
            // replace the first numberUpdated entries with the new ones
            state.entries = action.payload.concat(state.entries.slice(numberUpdated));
            toast.info(`Flowsheet saved and updated.`);
            state.editDepth = 0;
        })
        .addCase(loadFlowsheetEntries.rejected, (state) => {
            state.loading = false;
            toast.error("Could not save and update the flowsheet.");
        })
        .addCase(pushToEntries.pending, (state, action) => {
            state.loading = true;
        })
        .addCase(pushToEntries.rejected, (state) => {
            toast.error("Could not add the entry to the flowsheet.");
            state.loading = false;
        })
        .addCase(pushToEntries.fulfilled, (state, action) => {
            state.loading = false;
            let nextId = state.entries[0].id + 1;
            console.log(action.payload);
            console.log(nextId);
            console.log(state.entries.length);
            state.entries = [
                ({ ...action.payload, id: nextId }),
                ...state.entries
            ];
            state.editDepth = state.editDepth + 1;
            console.log(state.entries.length);
            console.log(state.editDepth);
        });
    }
});