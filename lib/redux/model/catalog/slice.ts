import { createSlice } from "@reduxjs/toolkit";
import { CatalogState } from "../..";

const initialState: CatalogState = {
    query: "",
    results: [],
};

export const catalogSlice = createSlice({
    name: "catalog",
    initialState,
    reducers: {
        
    },
});