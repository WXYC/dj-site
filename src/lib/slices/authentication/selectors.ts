import { createAppSelector } from "@/lib/hooks";
import { RootState } from "@/lib/store";

export const getIsPending = (state: RootState) => state.authentication.pending;
export const getCredentials = (state: RootState) =>
  state.authentication.credentials;
export const getValidation = (state: RootState) =>
  state.authentication.validation;

export const getAuthenticatedUser = (state: RootState) =>
  state.authentication.user;

export const getResponse = (state: RootState) => state.authentication.response;

export const getNeedsNewPassword = createAppSelector(
  [getResponse],
  (response) => response?.passwordChallenge ?? false
);

export const getIsValid = createAppSelector(
  [getValidation, getNeedsNewPassword],
  (validation, needsPassword) =>
    needsPassword
      ? Object.values(validation).every((v) => v)
      : validation.username && validation.password
);
