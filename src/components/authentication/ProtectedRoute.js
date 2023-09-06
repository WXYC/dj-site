import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../services/authentication/authentication-context";
import { toast } from "sonner";

const ProtectedRoute = (props) => {

  const { isAuthenticated, checkAuth, setIsAuthenticated, setAuthenticating, setAuthResult } = useAuth();

  const { location } = useLocation();

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
}, [location]);

  return isAuthenticated ? props.children : <Navigate to={`/login?continue=${window.location.pathname}`} />
};

export default ProtectedRoute;