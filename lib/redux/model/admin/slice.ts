import { createSlice } from "@reduxjs/toolkit";
import { AdminState } from "./types";
import { fetchDJs } from "./thunks";

const initialState: AdminState = {
    loading: false,
    error: null,
    djs: [],
};

export const adminSlice = createSlice({
    name: "admin",
    initialState,
    reducers: {

    },
    extraReducers: (builder) => {
        builder
        .addCase(fetchDJs.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
        .addCase(fetchDJs.fulfilled, (state, action) => {
            state.loading = false;
            state.error = null;
            state.djs = action.payload;
        })
        .addCase(fetchDJs.rejected, (state) => {
            state.loading = false;
            state.error = "Request to fetch DJ Roster was rejected. Do you have admin privileges?";
            state.djs = [];
        });
    }
});