import { createSlice } from "@reduxjs/toolkit";
import { AdminState } from "./types";

const initialState: AdminState = {
    loading: false,
    djs: [],
};

export const adminSlice = createSlice({
    name: "admin",
    initialState,
    reducers: {

    }
});