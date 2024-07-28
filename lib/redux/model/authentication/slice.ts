import { createSlice } from "@reduxjs/toolkit";
import { handleNewUser, login, verifySession } from "./thunks";
import { AuthenticationState } from "./types";
import { toast } from "sonner";

const initialState: AuthenticationState = {
  authenticating: false,
  isAuthenticated: false,
};

export const authenticationSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: (state) => {
      sessionStorage.clear();
      localStorage.clear();
      state.authenticating = false;
      state.isAuthenticated = false;
      state.user = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.authenticating = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.authenticating = action.payload.authenticating;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.authenticating = false;
        toast.error(action.error.message);
      })
      .addCase(verifySession.pending, (state) => {
        state.authenticating = true;
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        state.authenticating = false;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
      })
      .addCase(handleNewUser.pending, (state) => {
        state.authenticating = true;
      })
      .addCase(handleNewUser.fulfilled, (state, action) => {
        state.authenticating = false;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
      })
      .addCase(handleNewUser.rejected, (state, action) => {
        state.authenticating = false;
        toast.error(action.error.message);
      });
  },
});

export const { logout } = authenticationSlice.actions;
