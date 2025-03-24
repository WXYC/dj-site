import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import { AuthenticationState, VerifiedData } from "./types";

export const defaultAuthenticationState: AuthenticationState = {
  verifications: {
    username: false,
    realName: false,
    djName: false,
    password: false,
    confirmPassword: false,
    code: false,
  },
  required: ["username", "password", "confirmPassword"],
};

export const authenticationSlice = createAppSlice({
  name: "authentication",
  initialState: defaultAuthenticationState,
  reducers: (create) => ({
    verify: create.reducer(
      (
        state,
        action: PayloadAction<{ key: keyof VerifiedData; value: boolean }>
      ) => {
        state.verifications = {
          ...state.verifications,
          [action.payload.key]: action.payload.value,
        };
      }
    ),
    reset: create.reducer((state) => {
      state.verifications = defaultAuthenticationState.verifications;
      state.required = defaultAuthenticationState.required;
    }),
    addRequiredCredentials: create.reducer(
      (state, action: PayloadAction<(keyof VerifiedData)[]>) => {
        state.required = [...state.required, ...action.payload];
      }
    ),
  }),
  selectors: {
    getVerification: (state, key: keyof VerifiedData) => {
      return state.verifications[key];
    },
    requiredCredentialsVerified: (state) => {
      return state.required.every((key) => state.verifications[key]);
    },
    allCredentialsVerified: (state) => {
      return state.verifications.username && state.verifications.password;
    },
  },
});
