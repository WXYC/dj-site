"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useLogout } from "@/src/hooks/authenticationHooks";
import { ArrowBack } from "@mui/icons-material";
import { Button, Link } from "@mui/joy";

export default function AuthBackButton({
  text
} : {
  text?: string; // Optional prop for custom button text
}) {
  const { handleLogout, loggingOut } = useLogout();
  const dispatch = useAppDispatch();

  const handleBack = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dispatch(applicationSlice.actions.setAuthStage("login"));
    await handleLogout();
  };

  return (
    <form>
      <Link
        component={"button"}
        fontSize={"sm"}
        type="submit"
        disabled={loggingOut}
        startDecorator={<ArrowBack />}
        sx = {{
            justifyContent: "flex-start",
        }}
        onClick={handleBack}
      >
        {text || "Back to Login"}
      </Link>
    </form>
  );
}
