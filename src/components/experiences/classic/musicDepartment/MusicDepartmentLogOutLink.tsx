"use client";

import { useLogout } from "@/src/hooks/authenticationHooks";

/**
 * `mainmenu.jsp`'s last entry, `login?loginAction=endSession`. dj-site ends a
 * session through better-auth rather than a GET, so this makes the same
 * `useLogout` call the classic nav bar's Log Out makes. It is split out of the
 * menu so the menu itself stays a server component.
 */
export default function MusicDepartmentLogOutLink() {
  const { handleLogout } = useLogout();

  return (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault();
        handleLogout();
      }}
    >
      Log Out
    </a>
  );
}
