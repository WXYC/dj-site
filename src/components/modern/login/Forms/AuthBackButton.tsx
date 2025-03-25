"use client";

import { useLogout } from "@/src/hooks/authenticationHooks";
import { ArrowBack } from "@mui/icons-material";
import { Button, Link } from "@mui/joy";

export default function AuthBackButton({
  text
} : {
  text?: string; // Optional prop for custom button text
}) {
  const { handleLogout, loggingOut } = useLogout();

  return (
    <form onSubmit={handleLogout}>
      <Link
        component={"button"}
        fontSize={"sm"}
        type="submit"
        disabled={loggingOut}
        startDecorator={<ArrowBack />}
        sx = {{
            justifyContent: "flex-start",
        }}
      >
        {text || "Back to Login"}
      </Link>
    </form>
  );
}
