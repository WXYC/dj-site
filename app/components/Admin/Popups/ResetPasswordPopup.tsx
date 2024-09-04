'use client';

import { Button, FormControl, FormLabel, Input, Typography } from "@mui/joy"
import React, { useContext, useState } from "react"
import { DJ, adminSlice, applicationSlice, resetPassword, useDispatch } from "@/lib/redux";
import { PopupContentContextType } from "../../General/Popups/Popups";

type ResetPasswordContext = {
    dj: DJ;
}

/**
 * Represents a popup component for resetting a user's password.
 *
 * @component
 *
 * @param {Object} props - The component props.
 * @param {string} props.username - The username of the user whose password needs to be reset.
 *
 * @returns {JSX.Element} The ResetPasswordPopup component.
 */
export const ResetPasswordPopup = (props: ResetPasswordContext) => {

    const [loading, setLoading] = useState(false);
    const [newPassword, setNewPassword] = useState("");

    const dispatch = useDispatch();
    const closePopup = () => dispatch(applicationSlice.actions.closePopup());

    const handleChangePassword = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const { username, tempPassword, email } = (event.target as HTMLFormElement).elements as ResetPasswordFormElements;
        setLoading(true);
        (async () => {
            dispatch(resetPassword({
                dj: props.dj,
                temporaryPassword: tempPassword.value
            })).finally(() => {
                closePopup();
            });
        })();
    }

    return (
        <form
            onSubmit={handleChangePassword}
        >
            <input type="hidden" name="username" value={ props.dj.userName } />
            <Typography level="body-md">Reset Password for { props.dj.userName }</Typography>
            <FormControl required sx = {{ mt: 2 }}>
                <FormLabel>Temporary Password</FormLabel>
                <Input
                    type="text"
                    name="tempPassword"
                    value={newPassword}
                    required
                    onChange={(event) => setNewPassword(event.target.value)}
                />
            </FormControl>
            <FormControl required sx = {{ mt: 2 }}>
                <FormLabel>Notifying:</FormLabel>
                <Input
                    type="email"
                    name="email"
                    defaultValue={props.dj.email}
                    disabled
                />
            </FormControl>
            <Button 
                type="submit" 
                variant="solid" 
                color="success" 
                sx = {{ mt: 2 }} 
                loading={loading}
                disabled={loading || newPassword.length === 0}
            >
                Reset Password
            </Button>
        </form>
    )
}