import { Button, FormControl, FormLabel, Input, Typography } from "@mui/joy"
import React, { useContext, useState } from "react"
import { resetPassword } from "../../../services/station-management/admin-service";
import { PopupContentContext } from "../../../pages/dashboard/Popup";

export const ResetPasswordPopup = ({ username }) => {

    const [loading, setLoading] = useState(false);
    const { closePopup } = useContext(PopupContentContext);

    const handleChangePassword = (event) => {
        event.preventDefault();
        const { username, tempPassword, email } = event.target.elements;
        setLoading(true);
        (async () => {
            await resetPassword(username.value, tempPassword.value, email.value);
            setLoading(false);
            closePopup();
        })();
    }

    return (
        <form
            onSubmit={handleChangePassword}
        >
            <input type="hidden" name="username" value={ username } />
            <Typography level="body1">Reset Password for { username }</Typography>
            <FormControl required sx = {{ mt: 2 }}>
                <FormLabel>Temporary Password</FormLabel>
                <Input
                    type="text"
                    name="tempPassword"
                />
            </FormControl>
            <FormControl required sx = {{ mt: 2 }}>
                <FormLabel>Email to Notify</FormLabel>
                <Input
                    type="email"
                    name="email"
                />
            </FormControl>
            <Button type="submit" variant="solid" color="success" sx = {{ mt: 2 }} loading={loading}>Reset Password</Button>
        </form>
    )
}