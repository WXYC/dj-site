"use client";

import { applicationSlice, getClassicView, useDispatch, useSelector } from "@/lib/redux";
import { Alert, Button, Typography } from "@mui/joy";

export const Footer = () => {

    const classicView = useSelector(getClassicView);
    const dispatch = useDispatch();

    const toggleThemeSwitch = (e: any) => {
        e.preventDefault();
        dispatch(applicationSlice.actions.toggleClassicView());
    }

    return classicView ? (
        <Alert color="neutral">
            You are currently using classic view. <Button size="sm" variant="soft" color="primary" onClick={toggleThemeSwitch}>Switch</Button>
        </Alert>
    ) : (
        <Alert color="primary">
            You are currently using updated view. <Button size="sm" variant="outlined" color="neutral" onClick={toggleThemeSwitch}>Switch</Button>
        </Alert>
    );
}