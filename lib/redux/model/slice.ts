import { createSlice } from "@reduxjs/toolkit";
import { ApplicationState } from "./types";

export const initialState: ApplicationState = {
    enableClassicView: true, // set this to false to disable classic view option
    classicView: false,
    popupOpen: false,
    songCardOpen: false,
};

export const applicationSlice = createSlice({
    name: "application",
    initialState,
    reducers : {
        toggleClassicView: (state) => {
            state.classicView = !state.classicView;
        },
        openPopup: (state, action) => {
            state.popupContent = action.payload;
            state.popupOpen = true;
        },
        closePopup: (state) => {
            state.popupContent = undefined;
            state.popupOpen = false;
        },
        openSongCard: (state, action) => {
            state.songCardContent = action.payload;
            state.songCardOpen = true;
        },
        closeSongCard: (state) => {
            state.songCardOpen = false;
        }
    },
});