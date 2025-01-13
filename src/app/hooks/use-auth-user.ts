import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Authority, User } from "@/lib/models";
import { authenticationSlice } from "@/lib/slices";
import { getAuthenticatedUser } from "@/lib/slices/authentication/selectors";
import {
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
} from "aws-amplify/auth";
import { useEffect, useState } from "react";

export default function useAuthUser() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function getUser() {
      const session = await fetchAuthSession();
      if (!session.tokens) {
        return;
      }
      const user = {
        ...(await getCurrentUser()),
        ...(await fetchUserAttributes()),
        authority: Authority.None,
        djName: "",
      };
      const groups = session.tokens.accessToken.payload["cognito:groups"];
      // @ts-ignore
      var isMusicDirector = Boolean(groups && groups.includes("music-management"));
      // @ts-ignore
      var isStationManagement = Boolean(groups && groups.includes("station-management"));

      user.authority = !user ? Authority.None : (
        isStationManagement ? Authority.SM : (
          isMusicDirector ? Authority.MD : Authority.DJ
        )
      );

      user.djName = (user as any)["custom:dj-name"];

      dispatch(authenticationSlice.actions.setUser(user));
    }

    getUser();
  }, []);

  return useAppSelector(getAuthenticatedUser);
}
