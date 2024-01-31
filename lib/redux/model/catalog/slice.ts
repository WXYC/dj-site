import { createSlice } from "@reduxjs/toolkit";
import { CatalogState } from "../..";

const initialState: CatalogState = {
    query: "",
    loading: false,
    results: [],
    resultCount: 0,
    searchIn: "albums",
    genre: "any",
    orderBy: "album",
    orderDirection: "asc",
    noResultsRemain: false,
};

export const catalogSlice = createSlice({
    name: "catalog",
    initialState,
    reducers: {
        loadMore: (state) => {
            state.resultCount += 10;
        },
        setQuery: (state, action) => {
            state.query = action.payload;
        },
        setSearchIn: (state, action) => {
            state.searchIn = action.payload;
        },
        setGenre: (state, action) => {
            state.genre = action.payload;
        },
        setOrderBy: (state, action) => {
            state.orderBy = action.payload;
        },
        setOrderDirection: (state, action) => {
            state.orderDirection = action.payload;
        },
    },
});