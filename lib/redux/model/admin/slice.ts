import { createSlice } from "@reduxjs/toolkit";
import { addDJ, autoCompleteArtist, fetchDJs, makeMusicDirector, makeStationManager, populateMusicDirectors, populateStationManagers, removeMusicDirector, removeStationManager, resetPassword } from "./thunks";
import { AdminState } from "./types";
import { toast } from "sonner";
import { AdminType } from "../authentication";

const initialState: AdminState = {
    loading: false,
    adminLoading: false,
    musicDirectorLoading: false,
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
        .addCase(populateStationManagers.pending, (state) => {
            state.adminLoading = true;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(populateStationManagers.fulfilled, (state, action) => {
            state.adminLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
            state.djs = state.djs.map((dj) => {
                dj.adminType = action.payload.find((admin) => admin.userName === dj.userName) !== undefined ? 
                    AdminType.StationManager : 
                    dj.adminType ?? AdminType.None;
                return dj;
            });
        })
        .addCase(populateStationManagers.rejected, (state) => {
            state.adminLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = "Request to fetch Admin Roster was rejected. Do you have admin privileges?";
        })
        .addCase(populateMusicDirectors.pending, (state) => {
            state.musicDirectorLoading = true;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(populateMusicDirectors.fulfilled, (state, action) => {
            state.musicDirectorLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
            state.djs = state.djs.map((dj) => {
                if (dj.adminType !== AdminType.StationManager) {
                    dj.adminType = action.payload.find((admin) => admin.userName === dj.userName) !== undefined ? 
                        AdminType.MusicDirector : 
                        AdminType.None;
                }
                return dj;
            });
        })
        .addCase(populateMusicDirectors.rejected, (state) => {
            state.musicDirectorLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = "Request to fetch Admin Roster was rejected. Do you have admin privileges?";
        })
        .addCase(makeStationManager.pending, (state) => {
            state.adminLoading = true;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(makeStationManager.fulfilled, (state) => {
            state.adminLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(makeStationManager.rejected, (state, action) => {
            state.adminLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = action.error.message;
        })
        .addCase(makeMusicDirector.pending, (state) => {
            state.musicDirectorLoading = true;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(makeMusicDirector.fulfilled, (state) => {
            state.musicDirectorLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(makeMusicDirector.rejected, (state, action) => {
            state.musicDirectorLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = action.error.message;
        })
        .addCase(removeStationManager.pending, (state) => {
            state.adminLoading = true;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(removeStationManager.fulfilled, (state) => {
            state.adminLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(removeStationManager.rejected, (state, action) => {
            state.adminLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = action.error.message;
        })
        .addCase(removeMusicDirector.pending, (state) => {
            state.musicDirectorLoading = true;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(removeMusicDirector.fulfilled, (state) => {
            state.musicDirectorLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
            state.error = undefined;
        })
        .addCase(removeMusicDirector.rejected, (state, action) => {
            state.musicDirectorLoading = false;
            state.loading = state.adminLoading || state.musicDirectorLoading;
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