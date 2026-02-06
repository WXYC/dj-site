"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useLogout } from "@/src/hooks/authenticationHooks";
import { ArrowBack } from "@mui/icons-material";
import { Button, Link } from "@mui/joy";
import { useRouter } from "next/navigation";

export default function AuthBackButton({
  text
} : {
  text?: string; // Optional prop for custom button text
}) {
  const { handleLogout, loggingOut } = useLogout();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const handleBack = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dispatch(applicationSlice.actions.setAuthStage("login"));
    // Navigate to a clean /login URL first — this clears any stale ?token= or
    // ?error= search params that would otherwise re-trigger the reset flow
    // when the useEffect in LoginSlotSwitcher runs after the re-render.
    router.replace("/login");
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
