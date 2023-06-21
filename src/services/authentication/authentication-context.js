import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RedirectContext } from '../../App';
import { checkAuth, login, logout, updatePasswordFlow, updateUserInformation } from './authentication-service';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [authenticating, setAuthenticating] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [resetPasswordRequired, setResetPasswordRequired] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const [user, setUser] = useState({});

    const redirect = useContext(RedirectContext);

    useEffect(() => {
        const checkAuthStatus = async () => {
            setAuthenticating(true);
            try {
                const authResult = await checkAuth();
                setAuthResult(authResult);
            } catch (error) {
                toast.error(error.toString());
                setIsAuthenticated(false);
            } finally {
                setAuthenticating(false);
            }
        }
        checkAuthStatus();
    }, [redirect.redirect]);

    const handleLogin = async (event) => {
        event.preventDefault();
        setAuthenticating(true);
        try {
            const authResult = await login(event);
            setAuthResult(authResult);
        } catch (error) {
            toast.error(error.toString());
        } finally {
            setAuthenticating(false);
        }
    }

    const handleLogout = async () => {
        try {
            const authResult = await logout();
            setAuthResult(authResult);
        } catch (error) {
            toast.error(error.toString());
        }
    }

    const handlePasswordUpdate = async (event) => {
        event.preventDefault();
        setAuthenticating(true);
        try {
          const authResult = await updatePasswordFlow(event, user);
          setAuthResult(authResult);
        } catch (error) {
          toast.error(error.toString());
        } finally {
          setAuthenticating(false);
        }
    }

    const handleInformationUpdate = async (attributes) => {
      const authResult = await updateUserInformation(attributes);
      setAuthResult(authResult);
    }

    const setAuthResult = (authResult) => {
        setResetPasswordRequired(authResult.resetPasswordRequired);
        setIsAuthenticated(authResult.isAuthenticated);
        setIsAdmin(authResult.isAdmin);
        if (authResult.userObject && authResult.isAuthenticated) {
          let user = {
            Username: authResult.userObject.Username,
            djName: getUserAttribute(authResult.userObject, 'custom:dj-name', 'No DJ name!'),
            name: getUserAttribute(authResult.userObject, 'name', 'No name!'),
            showRealName: getUserAttribute(authResult.userObject, 'custom:show-real-name', 'false') === 'true',
            funFact: getUserAttribute(authResult.userObject, 'custom:fun-fact', ''),
            funFactType: getUserAttribute(authResult.userObject, 'custom:fun-fact-type', 'Favorite Artist'),
            isAdmin: authResult.isAdmin,
          }
          setUser(user);
        } else if (authResult.resetPasswordRequired) {
          setUser(authResult.userObject);
        }
      }
    
      const getUserAttribute = (unformattedUser, attributeName, defaultIfNull) => {
        return unformattedUser?.UserAttributes?.find((attr) => attr.Name === attributeName)?.Value ?? defaultIfNull ?? 'No attribute!';
      }

    return (
        <AuthContext.Provider value={{
            authenticating,
            isAuthenticated,
            resetPasswordRequired,
            isAdmin,
            user,
            handleLogin,
            handleLogout,
            handlePasswordUpdate,
            handleInformationUpdate
        }}>
            {children}
        </AuthContext.Provider>
    );
}
