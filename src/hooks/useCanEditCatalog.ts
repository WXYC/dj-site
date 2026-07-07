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
  const [jwtUserId, setJwtUserId] = useState<string | undefined>();

  const userId =
    session?.user?.id ??
    (isAuthenticated(data) ? data.user?.id : undefined);

  // Render-time gate: ignore JWT edit state until it is resolved for userId.
  const jwtEditAllowed =
    userId != null && userId === jwtUserId ? jwtAllowsEdit : false;

  useEffect(() => {
    if (!userId) {
      setJwtUserId(undefined);
      setJwtAllowsEdit(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const token = await getJWTToken();
      if (cancelled) {
        return;
      }
      if (!token) {
        setJwtUserId(userId);
        setJwtAllowsEdit(false);
        return;
      }
      const role = organizationRoleFromJwtToken(token, userId);
      setJwtUserId(userId);
      setJwtAllowsEdit(
        role ? roleToAuthorization(role) >= Authorization.MD : false,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (jwtEditAllowed) {
    return true;
  }
  if (isAuthenticated(data) && data.user) {
    return data.user.authority >= Authorization.MD;
  }
  return false;
}
