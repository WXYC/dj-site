import { Button, FormControl, FormLabel, Input, Typography } from "@mui/joy"
import React from "react"

export const ResetPasswordPopup = ({ username }) => {
    return (
        <form>
            <Typography level="body1">Reset Password for { username }</Typography>
            <FormControl required sx = {{ mt: 2 }}>
                <FormLabel>Temporary Password</FormLabel>
                <Input
                    type="text"
                    
                />
            </FormControl>
            <FormControl required sx = {{ mt: 2 }}>
                <FormLabel>Email to Notify</FormLabel>
                <Input
                    type="email"
                />
            </FormControl>
            <Button type="submit" variant="solid" color="success" sx = {{ mt: 2 }}>Reset Password</Button>
        </form>
    )
}