/* Instruments */
import { useDispatch, type ReduxState, User, type AuthenticatingUser } from "@/lib/redux";

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state: RootState) => state.counter.value)`
export const isLoggedIn = (state: ReduxState) => state.auth.isAuthenticated;
export const isAuthenticating = (state: ReduxState) => state.auth.authenticating;
export const needsNewPassword = (state: ReduxState) => (state.auth.user as AuthenticatingUser)?.resetPassword ?? false;

export const getCurrentUser = (state: ReduxState) => state.auth.user;
export const getAuthenticatedUser = (state: ReduxState): User | undefined => {
    if (state.auth.isAuthenticated && isAuthenticatedUser(state.auth.user)) {
        return state.auth.user;
    }

    return undefined;
}

function isAuthenticatedUser(user: User | AuthenticatingUser | undefined): user is User {
    return (user as User)?.djName !== undefined;
}
