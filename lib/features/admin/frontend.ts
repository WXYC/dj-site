import { createAppSlice } from "@/lib/createAppSlice";
import { AdminFrontendState, Authorization } from "./types";

export const defaultAdminFrontendState: AdminFrontendState = {
  searchString: "",
  page: 0,
  totalAccounts: 0,
  adding: false,
  formData: {
    authorization: Authorization.DJ,
  },
};

export const adminSlice = createAppSlice({
  name: "admin",
  initialState: defaultAdminFrontendState,
  reducers: {
    setSearchString: (state, action) => {
      state.searchString = action.payload;
      state.page = 0;
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    setTotalAccounts: (state, action) => {
      state.totalAccounts = action.payload;
    },
    setAdding: (state, action) => {
      state.adding = action.payload;
      if (!action.payload) {
        state.formData = {
          ...defaultAdminFrontendState.formData,
        }
      }
    },
    setFormData: (state, action) => {
      state.formData = {
        ...state.formData,
        ...action.payload,
      };
    },
    reset: () => defaultAdminFrontendState,
  },
  selectors: {
    getSearchString: (state) => state.searchString,
    getPage: (state) => state.page,
    getTotalAccounts: (state) => state.totalAccounts,
    getAdding: (state) => state.adding,
    getFormData: (state) => state.formData,
  },
});
