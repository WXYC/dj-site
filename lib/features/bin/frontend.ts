import { createAppSlice } from "@/lib/createAppSlice";
import { BinFrontendState } from "./types";


export const defaultBinFrontendState: BinFrontendState = {
    searchQuery: "",
}

export const binSlice = createAppSlice({
    name: "bin",
    initialState: defaultBinFrontendState,
    reducers: {
        setSearchQuery: (state, action) => {
            state.searchQuery = action.payload;
        },
    },
    selectors: {
        getSearchQuery: (state) => state.searchQuery,
    }
});
