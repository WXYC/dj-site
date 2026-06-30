"use client";

import { Authorization } from "@/lib/features/admin/types";
import { authClient, getJWTToken } from "@/lib/features/authentication/client";
import { organizationRoleFromJwtToken } from "@/lib/features/authentication/organization-utils";
import { isAuthenticated, roleToAuthorization } from "@/lib/features/authentication/types";
import { useEffect, useState } from "react";
import { useAuthentication } from "./authenticationHooks";

export function useCanEditCatalog(): boolean {
  const { data: session } = authClient.useSession();
  const { data } = useAuthentication();
  const [jwtAllowsEdit, setJwtAllowsEdit] = useState(false);

  const userId =
    session?.user?.id ??
    (isAuthenticated(data) ? data.user?.id : undefined);

  useEffect(() => {
    setJwtAllowsEdit(false);

    if (!userId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const token = await getJWTToken();
      if (cancelled || !token) {
        return;
      }
      const role = organizationRoleFromJwtToken(token, userId);
      if (!cancelled && role) {
        setJwtAllowsEdit(roleToAuthorization(role) >= Authorization.MD);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (jwtAllowsEdit) {
    return true;
  }
  if (isAuthenticated(data) && data.user) {
    return data.user.authority >= Authorization.MD;
  }
  return false;
}
