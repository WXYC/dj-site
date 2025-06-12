import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import { AuthenticationState, ModifiableData, VerifiedData } from "./types";

export const defaultAuthenticationState: AuthenticationState = {
  verifications: {
    username: false,
    realName: false,
    djName: false,
    password: false,
    confirmPassword: false,
    code: false,
  },
  modifications: {
    realName: false,
    djName: false,
    email: false,
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
    modify: create.reducer(
      (
        state,
        action: PayloadAction<{ key: keyof ModifiableData; value: boolean }>
      ) => {
        state.modifications = {
          ...state.modifications,
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
    resetModifications: create.reducer((state) => {
      state.modifications = defaultAuthenticationState.modifications;
    }),
  }),
  selectors: {
    getVerification: (state, key: keyof VerifiedData) => {
      return state.verifications[key];
    },
    getModifications: (state) => {
      return Object.entries(state.modifications)
        .filter(([_, value]) => value)
        .map(([key, _]) => key as keyof ModifiableData);
    },
    requiredCredentialsVerified: (state) => {
      return state.required.every((key) => state.verifications[key]);
    },
    allCredentialsVerified: (state) => {
      return state.verifications.username && state.verifications.password;
    },
    isModified: (state) => {
      return Object.values(state.modifications).some((value) => value);
    },
  },
});
