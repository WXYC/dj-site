import { createSlice } from "@reduxjs/toolkit";
import { ScheduleState } from "./types";

const initialState: ScheduleState = {
    
}

export const scheduleSlice = createSlice({
    name: "schedule",
    initialState,
    reducers: {
        setForDJ: (state, action) => {
            state.forDJ = action.payload;
        },
    },
    extraReducers(builder) { }
});