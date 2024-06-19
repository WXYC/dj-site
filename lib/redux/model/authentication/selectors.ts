/* Instruments */
import {
  useDispatch,
  type ReduxState,
  User,
  type AuthenticatingUser,
} from "@/lib/redux";

export const isLoggedIn = (state: ReduxState) => state.auth.isAuthenticated;
export const isAuthenticating = (state: ReduxState) =>
  state.auth.authenticating;
export const needsNewPassword = (state: ReduxState) =>
  (state.auth.user as AuthenticatingUser)?.resetPassword ?? false;

export const getCurrentUser = (state: ReduxState) => state.auth.user;
export const getAuthenticatedUser = (state: ReduxState): User | undefined => {
  if (state.auth.isAuthenticated && isAuthenticatedUser(state.auth.user)) {
    return state.auth.user;
  }

  return undefined;
};

function isAuthenticatedUser(
  user: User | AuthenticatingUser | undefined
): user is User {
  return (user as User)?.djName !== undefined;
}
