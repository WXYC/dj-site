import { createSlice } from "@reduxjs/toolkit";
import { BinState } from "./types";
import { deleteAllFromBin, deleteFromBin, insertToBin, loadBin } from "./thunks";

const initialState: BinState = {
    loading: false,
    bin: [],
};

export const binSlice = createSlice({
    name: "bin",
    initialState,
    reducers: { },
    extraReducers: (builder) => {
        builder
        .addCase(loadBin.pending, (state) => {
            state.loading = true;
        })
        .addCase(loadBin.fulfilled, (state, action) => {
            state.loading = false;
            state.bin = action.payload;
        })
        .addCase(loadBin.rejected, (state) => {
            state.loading = false;
        })
        .addCase(deleteFromBin.pending, (state) => {
            state.loading = true;
        })
        .addCase(deleteFromBin.fulfilled, (state) => {
            state.loading = false;
        })
        .addCase(deleteFromBin.rejected, (state) => {
            state.loading = false;
        })
        .addCase(deleteAllFromBin.pending, (state) => {
            state.loading = true;
        })
        .addCase(deleteAllFromBin.fulfilled, (state) => {
            state.loading = false;
        })
        .addCase(deleteAllFromBin.rejected, (state) => {
            state.loading = false;
        })
        .addCase(insertToBin.pending, (state) => {
            state.loading = true;
        })
        .addCase(insertToBin.fulfilled, (state) => {
            state.loading = false;
        })
        .addCase(insertToBin.rejected, (state) => {
            state.loading = false;
        });
    }
});