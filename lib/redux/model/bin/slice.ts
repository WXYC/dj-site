import { createSlice } from "@reduxjs/toolkit";
import { BinState } from "./types";

const initialState: BinState = {
    bin: [],
};

export const binSlice = createSlice({
    name: "bin",
    initialState,
    reducers: {
        addBin: (state, action) => {
            state.bin = action.payload;
        },
    },
});