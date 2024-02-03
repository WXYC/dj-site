import { createSlice } from "@reduxjs/toolkit";
import { RotationState } from "./types";

const initialState: RotationState = {
    loading: false,
    entries: [],
};

export const rotationSlice = createSlice({
    name: "rotation",
    initialState,
    reducers: {
        addRotation: (state, action) => {
            state.entries.push(action.payload);
        },
    },
});