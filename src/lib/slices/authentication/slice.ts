import { createAppSlice } from "@/lib/createAppSlice";
import {
  AuthenticationState,
  SigninResponse,
  UpdateCredentialPayload,
} from "@/lib/models";

import { PayloadAction } from "@reduxjs/toolkit";

const initialState: AuthenticationState = {
  credentials: {
    username: "",
    password: "",
    realname: "",
    djname: "",
  },
  validation: {
    username: false,
    password: false,
    realname: false,
    djname: false,
    compareTo: false,
  },
  response: undefined,
  pending: false,
  user: undefined,
};

export const authenticationSlice = createAppSlice({
  name: "authentication",
  initialState,
  reducers: {
    setResponse(state, action: PayloadAction<SigninResponse>) {
      state.response = action.payload;
      if (action.payload?.passwordChallenge) {
        state.credentials.password = "";
      }
    },
    setPending(state, action: PayloadAction<boolean>) {
      state.pending = action.payload;
    },
    setUser(state, action: PayloadAction<AuthenticationState["user"]>) {
      state.user = action.payload;
    },
    updateCredentials(
      state,
      action: PayloadAction<AuthenticationState["credentials"]>
    ) {
      state.credentials = action.payload;
    },
    updateValidation(state, action: PayloadAction<UpdateCredentialPayload>) {
      state.validation[action.payload.field] = action.payload.approved;
    },
    reset(state) {
      state.credentials = initialState.credentials;
      state.validation = initialState.validation;
      state.response = initialState.response;
      state.pending = initialState.pending;
      state.user = initialState.user;
    },
  },
});
