import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../services/authentication/authentication-context";
import { toast } from "sonner";

const ProtectedRoute = (props) => {

  const { isAuthenticated, checkAuth, setIsAuthenticated, setAuthenticating, setAuthResult } = useAuth();

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
}, []);

  return isAuthenticated ? props.children : <Navigate to={`/login?continue=${window.location.pathname}`} />
};

export default ProtectedRoute;