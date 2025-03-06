"use client";

import { useLogout } from "@/src/hooks/authenticationHooks";
import { ArrowBack } from "@mui/icons-material";
import { Button } from "@mui/joy";

export default function ResetBackButton() {
  const { handleLogout, loggingOut } = useLogout();

  return (
    <form onSubmit={handleLogout}>
      <Button
        variant="plain"
        type="submit"
        size="sm"
        disabled={loggingOut}
        loading={loggingOut}
        startDecorator={<ArrowBack />}
        sx = {{
            justifyContent: "flex-start",
        }}
      >
        Login with a different account
      </Button>
    </form>
  );
}
