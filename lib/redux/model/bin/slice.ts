import { createSlice } from "@reduxjs/toolkit";
import { BinState } from "./types";

const initialState: BinState = {
    bin: [],
};

export const binSlice = createSlice({
    name: "bin",
    initialState,
    reducers: {
        loadBin: (state, action) => {
            state.bin = action.payload;
        },
        addToBin: (state, action) => {
            state.bin.push(action.payload);
        },
        removeFromBin: (state, action) => {
            state.bin = state.bin.filter((item) => item.album.id !== action.payload);
        },
        clearBin: (state) => {
            state.bin = [];
        },
    },
});