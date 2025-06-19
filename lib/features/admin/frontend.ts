import { createAppSlice } from "@/lib/createAppSlice";
import { AdminFrontendState } from "./types";

export const defaultAdminFrontendState: AdminFrontendState = {
  searchString: "",
};

export const adminSlice = createAppSlice({
  name: "application",
  initialState: defaultAdminFrontendState,
  reducers: {
    setSearchString: (state, action) => {
      state.searchString = action.payload;
    },
    reset: () => defaultAdminFrontendState,
  },
  selectors: {
    getSearchString: (state) => state.searchString,
  },
});
