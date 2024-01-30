import { createSlice } from "@reduxjs/toolkit";

export const rotationSlice = createSlice({
    name: "rotation",
    initialState: {
        rotation: [],
    },
    reducers: {
        addRotation: (state, action) => {
            state.rotation = action.payload;
        },
    },
});