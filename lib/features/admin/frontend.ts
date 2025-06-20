import { createAppSlice } from "@/lib/createAppSlice";
import { AdminFrontendState, Authorization } from "./types";

export const defaultAdminFrontendState: AdminFrontendState = {
  searchString: "",
  adding: false,
  formData: {
    authorization: Authorization.DJ,
  },
};

export const adminSlice = createAppSlice({
  name: "application",
  initialState: defaultAdminFrontendState,
  reducers: {
    setSearchString: (state, action) => {
      state.searchString = action.payload;
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
    getAdding: (state) => state.adding,
    getFormData: (state) => state.formData,
  },
});
