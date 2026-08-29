import { createAppSlice } from "@/lib/createAppSlice";
import { AdminFrontendState, Authorization } from "./types";

export const defaultAdminFrontendState: AdminFrontendState = {
  searchString: "",
  roleFilter: [],
  onboardingFilter: "all",
  page: 0,
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
    // Narrowing the roster under the admin's feet would leave them on a page
    // that no longer exists, so both filters send them back to the first one.
    setRoleFilter: (state, action) => {
      state.roleFilter = action.payload;
      state.page = 0;
    },
    setOnboardingFilter: (state, action) => {
      state.onboardingFilter = action.payload;
      state.page = 0;
    },
    setPage: (state, action) => {
      state.page = action.payload;
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
    getRoleFilter: (state) => state.roleFilter,
    getOnboardingFilter: (state) => state.onboardingFilter,
    getPage: (state) => state.page,
    getAdding: (state) => state.adding,
    getFormData: (state) => state.formData,
  },
});
