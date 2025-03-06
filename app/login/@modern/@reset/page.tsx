"use client";

import { useLogout } from "@/src/hooks/authenticationHooks";
import { Button } from "@mui/joy";

export default function Home() {
  const { handleLogout, loggingOut } = useLogout();

  return (
    <div>
      <h1>Welcome to Next.js</h1>
      <p>This is a modern reset password page template.</p>

      <form onSubmit={handleLogout}>
        <Button type="submit" loading={loggingOut}>
          Logout
        </Button>
      </form>
    </div>
  );
}
