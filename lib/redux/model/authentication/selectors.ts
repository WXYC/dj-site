/* Instruments */
import {
  useDispatch,
  type ReduxState,
  User,
  type AuthenticatingUser,
  AuthenticatingUserState,
} from "@/lib/redux";

export const isLoggedIn = (state: ReduxState) => state.auth.isAuthenticated;
export const isAuthenticating = (state: ReduxState) =>
  state.auth.authenticating;
export const isNewUser = (state: ReduxState) =>
  (state.auth.user as AuthenticatingUser)?.userType == AuthenticatingUserState.IsNewUser ?? false;
export const needsNewPassword = (state: ReduxState) =>
  (state.auth.user as AuthenticatingUser)?.userType == AuthenticatingUserState.IsResettingPassword ?? false;

export const getFloatingUsername = (state: ReduxState) =>
  (state.auth.user as AuthenticatingUser)?.username ?? undefined;
export const getFloatingSession = (state: ReduxState) =>
  (state.auth.user as AuthenticatingUser)?.session ?? undefined;

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
