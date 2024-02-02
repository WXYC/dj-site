import { createSlice } from "@reduxjs/toolkit";
import { CatalogState, useDispatch } from "../..";
import { searchCatalog } from "./thunks";

const initialState: CatalogState = {
    query: "",
    loading: false,
    results: [],
    resultCount: 10,
    searchIn: "All",
    genre: "All",
    orderBy: "Title",
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
            state.noResultsRemain = false;
            state.resultCount = 10;
        },
        setSearchIn: (state, action) => {
            state.searchIn = action.payload;
            state.noResultsRemain = false;
        },
        setGenre: (state, action) => {
            state.genre = action.payload;
            state.noResultsRemain = false;
        },
        setOrderBy: (state, action) => {
            state.orderBy = action.payload;
        },
        setOrderDirection: (state, action) => {
            state.orderDirection = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
        .addCase(searchCatalog.pending, (state) => {
            state.loading = true;
        })
        .addCase(searchCatalog.fulfilled, (state, action) => {
            state.loading = false;
            state.results = action.payload;
            state.noResultsRemain = action.payload.length < state.resultCount && action.payload.length > 0;
        });
    },
});