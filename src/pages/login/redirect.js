import React from "react";

import { Navigate, useParams } from "react-router-dom";

/**
 * @component
 * @category Authentication
 * 
 * @description Redirects to the login page, with a query parameter indicating the page to redirect to after login.
 * 
 * @returns {JSX.Element} The rendered Redirect component.
 */
export default function Redirect() {
    const { redirect } = useParams();
    return (
        <Navigate to={'/login?continue=' + (redirect.split('#')?.[1] ?? redirect ?? '/catalog')} />
    );
}