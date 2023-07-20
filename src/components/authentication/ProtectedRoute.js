import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../services/authentication/authentication-context";

const ProtectedRoute = (props) => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? props.children : <Navigate to={`/login?continue=${window.location.pathname}`} />
};

export default ProtectedRoute;