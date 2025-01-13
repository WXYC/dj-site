"use client";

import { handleSignOut } from "@/lib/cognitoActions";
import { useFormState } from "react-dom";

export default function ClassicLogout() {
  
    const [, logout] = useFormState(handleSignOut, undefined);

  return (
    <form onSubmit={logout}>
    <button type="submit">
      Log Out
    </button>
    </form>
  );
}
