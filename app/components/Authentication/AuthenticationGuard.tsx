"use client";

import {
  AdminType,
  getAuthenticatedUser,
  getCurrentUser,
  isAuthenticating,
  isLoggedIn,
  useDispatch,
  useSelector,
  verifySession,
} from "@/lib/redux";
import { Box, CircularProgress, Modal } from "@mui/joy";
import { redirect, usePathname } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

interface AuthenticationGuardProps {
  redirectTo: string;
  savePath?: boolean;
}

const AuthenticationGuard = (props: AuthenticationGuardProps) => {
  const dispatch = useDispatch();
  const pathname = usePathname();

  const authenticating = useSelector(isAuthenticating);
  const loggedIn = useSelector(isLoggedIn);

  const user = useSelector(getAuthenticatedUser);

  useEffect(() => {
    dispatch(verifySession());
  }, [dispatch]);

  if (authenticating) {
    return (
      <Modal open={true} style={{ zIndex: 10000 }}>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            width: "100%",
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

  if (loggedIn && pathname.includes("admin") && user?.adminType == AdminType.None)
    {
      toast.error("You do not have permission to access this page.");
      redirect("/");
    }
};

export default AuthenticationGuard;
