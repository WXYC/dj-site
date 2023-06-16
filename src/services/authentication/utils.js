import { Auth } from 'aws-amplify';
import { toast } from 'sonner';

const quietErrors = ['The user is not authenticated'];

const nullResult = { userObject: {}, resetPasswordRequired: false, isAuthenticated: false, isAdmin: false };

export const checkAuth = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();

      if (user === null || user === {} || user === undefined) {
        return nullResult;
      }

      if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
        return { userObject: user, resetPasswordRequired: true, isAuthenticated: false, isAdmin: false };
      } else {
        return { 
            userObject: user, 
            resetPasswordRequired: false, 
            isAuthenticated: true, 
            isAdmin: user?.signInUserSession?.idToken?.payload?.['cognito:groups']?.includes('station-management') 
        }
      }
    } catch (error) {
      handleError(error);
        return nullResult;
    }
  }

  export const login = async (event) => {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;

    try {
        const user = await Auth.signIn(username, password);

        if (user === null || user === undefined) {
            return nullResult;
        }
      
        return { 
            userObject: user, 
            resetPasswordRequired: user?.challengeName === 'NEW_PASSWORD_REQUIRED', 
            isAuthenticated: true, 
            isAdmin: user?.signInUserSession?.idToken?.payload?.['cognito:groups']?.includes('station-management') 
        }
    }
    catch (error) {
      handleError(error);
      return nullResult;
    }

  }

  export const logout = async () => {
    try {
      await Auth.signOut();
        return { userObject: {}, resetPasswordRequired: false, isAuthenticated: false, isAdmin: false }
    }
    catch (error) {
      handleError(error);
        return nullResult;
    }
  }

  export const updatePassword = async (event, user_challenged) => {
    event.preventDefault();
    try {
      const user = await Auth.completeNewPassword(
        user_challenged,
        event.target.password.value,
        {
          name: event.target.realName.value,
        }
      );
      await Auth.updateUserAttributes(
        user,
        {
          'custom:djName' : event.target.djName.value,
        }
      );
      return { userObject: user, 
        resetPasswordRequired: false, 
        isAuthenticated: true, 
        isAdmin: user?.signInUserSession?.idToken?.payload?.['cognito:groups']?.includes('station-management')
    };
    } catch (error) {
      handleError(error);
        return nullResult;
    }
  }

  const handleError = (error) => {
    if (!quietErrors.includes(error.toString())) {
      toast.error(error.toString());
    }
  }