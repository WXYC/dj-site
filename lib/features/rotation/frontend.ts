import { createAppSlice } from "@/lib/createAppSlice";
import { RotationFrontendState } from "./types";

export const defaultRotationFrontendState: RotationFrontendState = {
  orderBy: "title",
  orderDirection: "asc",
};

export const rotationSlice = createAppSlice({
  name: "rotation",
  initialState: defaultRotationFrontendState,
  reducers: {
    setOrderBy: (state, action) => {
      state.orderBy = action.payload;
    },
    setOrderDirection: (state, action) => {
      state.orderDirection = action.payload;
    },
  },
  selectors: {
    orderBy: (state) => state.orderBy,
    orderDirection: (state) => state.orderDirection,
  },
});
