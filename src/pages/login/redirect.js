import React from "react";

import { Navigate, useParams } from "react-router-dom";


export default function Redirect() {
    const { redirect } = useParams();
    return (
        <Navigate to={'/login?continue=' + (redirect.split('#')?.[1] ?? redirect ?? '/catalog')} />
    );
}