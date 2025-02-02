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
    }),
  }),
  selectors: {
    getVerification: (state, key: keyof VerifiedData) => {
      return state.verifications[key];
    },
    allCredentialsVerified: (state) => {
      return state.verifications.username && state.verifications.password;
    },
    allUserVerified: (state) => {
      return (
        state.verifications.username &&
        state.verifications.realName &&
        state.verifications.djName &&
        state.verifications.password &&
        state.verifications.confirmPassword
      );
    },
    allResetPasswordCredentialsVerified: (state) => {
      return (
        state.verifications.code &&
        state.verifications.password &&
        state.verifications.confirmPassword
      );
    },
  },
});
