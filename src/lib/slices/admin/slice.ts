import { createSlice } from "@reduxjs/toolkit";
import {
  addDJ,
  demote,
  /* autoCompleteArtist, */ fetchDJs,
  populateAdmins,
  promote,
  resetAccount,
} from "./thunks";
import { AdminState } from "../../models/admin/types";
import { toast } from "sonner";
import { Authority } from "../../models/authentication";

const initialState: AdminState = {
  loading: false,
  error: undefined,
  djs: [],
  //autocompletedArtists: []
};

export const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {},
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
        state.error =
          "Request to fetch DJ Roster was rejected. Do you have admin privileges?";
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
          dj.authority = Authority.DJ;
          action.payload.MusicDirectors.forEach((md) => {
            if (md.username === dj.username) {
              dj.authority = Authority.MD;
            }
          });
          action.payload.StationManagers.forEach((sm) => {
            if (sm.username === dj.username) {
              dj.authority = Authority.SM;
            }
          });
          return dj;
        });
      })
      .addCase(populateAdmins.rejected, (state) => {
        state.loading = false;
        state.error =
          "Request to fetch Admin Roster was rejected. Do you have admin privileges?";
      })
      .addCase(promote.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(promote.fulfilled, (state) => {
        state.loading = false;
        state.error = undefined;
      })
      .addCase(promote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(demote.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(demote.fulfilled, (state) => {
        state.loading = false;
        state.error = undefined;
      })
      .addCase(demote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(resetAccount.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(resetAccount.fulfilled, (state) => {
        state.loading = false;
        state.error = undefined;
      })
      .addCase(resetAccount.rejected, (state, action) => {
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
      }) /* 
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
        }) */;
  },
});
