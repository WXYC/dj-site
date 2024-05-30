import { createSlice } from "@reduxjs/toolkit";
import { FlowSheetEntry, FlowSheetState } from "./types";
import { getIsLive, join, leave, loadFlowsheet, loadFlowsheetEntries } from "./thunks";
import { toast } from "sonner";
import { CatalogResult } from "../catalog";
import { convertCatalogToFlowsheet } from "../..";


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
        },
        addToEntries: (state, action) => {
            let nextId = state.entries[0].id + 1;
            console.log(action.payload);
            state.entries.push({ ...action.payload, id: nextId });
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
        .addCase(loadFlowsheet.pending, (state) => {
            state.loading = true;
        })
        .addCase(loadFlowsheet.fulfilled, (state, action) => {
            state.loading = false;
            state.entries = action.payload;
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
        })
        .addCase(loadFlowsheetEntries.rejected, (state) => {
            state.loading = false;
            toast.error("Could not save and update the flowsheet.");
        });
    }
});