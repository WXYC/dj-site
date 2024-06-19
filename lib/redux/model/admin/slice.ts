import { createSlice } from "@reduxjs/toolkit";
import { addDJ, autoCompleteArtist, fetchDJs, makeAdmin, populateAdmins, removeAdmin, resetPassword } from "./thunks";
import { AdminState } from "./types";
import { toast } from "sonner";

const initialState: AdminState = {
    loading: false,
    error: undefined,
    djs: [],
    autocompletedArtists: []
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
            state.error = undefined;
        })
        .addCase(fetchDJs.fulfilled, (state, action) => {
            state.loading = false;
            state.error = undefined;
            state.djs = action.payload;
        })
        .addCase(fetchDJs.rejected, (state) => {
            state.loading = false;
            state.error = "Request to fetch DJ Roster was rejected. Do you have admin privileges?";
            state.djs = [];
        })
        .addCase(populateAdmins.pending, (state) => {
            state.loading = true;
            state.error = undefined;
        })
        .addCase(populateAdmins.fulfilled, (state, action) => {
            state.loading = false;
            state.error = undefined;
            state.djs = state.djs.map((dj) => {
                dj.isAdmin = action.payload.find((admin) => admin.userName === dj.userName) !== undefined;
                return dj;
            });
        })
        .addCase(populateAdmins.rejected, (state) => {
            state.loading = false;
            state.error = "Request to fetch Admin Roster was rejected. Do you have admin privileges?";
        })
        .addCase(makeAdmin.pending, (state) => {
            state.loading = true;
            state.error = undefined;
        })
        .addCase(makeAdmin.fulfilled, (state) => {
            state.loading = false;
            state.error = undefined;
        })
        .addCase(makeAdmin.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message;
        })
        .addCase(removeAdmin.pending, (state) => {
            state.loading = true;
            state.error = undefined;
        })
        .addCase(removeAdmin.fulfilled, (state) => {
            state.loading = false;
            state.error = undefined;
        })
        .addCase(removeAdmin.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message;
        })
        .addCase(resetPassword.pending, (state) => {
            state.loading = true;
            state.error = undefined;
        })
        .addCase(resetPassword.fulfilled, (state) => {
            state.loading = false;
            state.error = undefined;
        })
        .addCase(resetPassword.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message;
        })
        .addCase(addDJ.pending, (state) => {
            state.loading = true;
            state.error = undefined;
        })
        .addCase(addDJ.fulfilled, (state) => {
            state.loading = false;
            state.error = undefined;
        })
        .addCase(addDJ.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message;
        })
        .addCase(autoCompleteArtist.pending, (state) => {
            state.error = undefined;
            state.autocompletedArtists = [];
        })
        .addCase(autoCompleteArtist.fulfilled, (state, action) => {
            state.error = undefined;
            state.autocompletedArtists = action.payload;
        })
        .addCase(autoCompleteArtist.rejected, (state, action) => {
            state.error = action.error.message;
        });
    }
});