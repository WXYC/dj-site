import { createSlice } from "@reduxjs/toolkit";
import { RotationState } from "./types";
import { addToRotation, loadRotation } from "./thunks";

const initialState: RotationState = {
    loading: false,
    entries: [],
    orderBy: "Title",
    orderDirection: "asc",
};

export const rotationSlice = createSlice({
    name: "rotation",
    initialState,
    reducers : {
        setOrderBy: (state, action) => {
            state.orderBy = action.payload;
        },
        setOrderDirection: (state, action) => {
            state.orderDirection = action.payload;
        },
    },
    extraReducers(builder) {
        builder
        .addCase(loadRotation.pending, (state) => {
            state.loading = true;
        })
        .addCase(loadRotation.fulfilled, (state, action) => {
            state.loading = false;
            state.entries = action.payload;
        })
        .addCase(loadRotation.rejected, (state) => {
            state.loading = false;
        })
        .addCase(addToRotation.pending, (state) => {
            state.loading = true;
        })
        .addCase(addToRotation.fulfilled, (state) => {
            state.loading = false;
        })
        .addCase(addToRotation.rejected, (state) => {
            state.loading = false;
        });
    },
});