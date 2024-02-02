'use client';

import { isAuthenticating, isLoggedIn, useDispatch, useSelector, verifySession } from "@/lib/redux";
import { Box, CircularProgress, Modal } from "@mui/joy";
import { redirect, usePathname } from "next/navigation";
import { useEffect } from "react";

interface AuthenticationGuardProps {
    redirectTo: string;
    savePath?: boolean;
}

const AuthenticationGuard = (props: AuthenticationGuardProps) => {
    const dispatch = useDispatch();
    const pathname = usePathname();

    const authenticating = useSelector(isAuthenticating);
    const loggedIn = useSelector(isLoggedIn);

    useEffect(() => {
        dispatch(verifySession());
    }, [dispatch]);

    if (authenticating) {
        return (
            <Modal open={true}>
                <Box
                    sx = {{
                        alignItems: "center",
                        display: "flex",
                        height: "100%",
                        justifyContent: "center",
                        width: "100%"
                    }}
                >
                    <CircularProgress />
                </Box>
            </Modal>
        );
    }

    if (!loggedIn && !pathname.startsWith(props.redirectTo)) {
        var redirectPath = props.redirectTo;
        redirectPath += props.savePath ? `?redirect=${pathname}` : "";
        redirect(redirectPath);
    }

};

export default AuthenticationGuard;