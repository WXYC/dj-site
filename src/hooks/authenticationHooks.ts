"use client";

import {
  useGetAuthenticationQuery,
  useGetDJInfoQuery,
  useLoginMutation,
  useLogoutMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import {
  AuthenticatedUser,
  isAuthenticated,
} from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { resetApplication } from "./applicationHooks";

export const useLogin = () => {
  const router = useRouter();

  const verified = useAppSelector(
    authenticationSlice.selectors.allCredentialsVerified
  );

  const { handleLogout } = useLogout();

  const [login, result] = useLoginMutation();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const username = e.currentTarget.username.value;
    const password = e.currentTarget.password.value;

    login({ username, password });
  };

  useEffect(() => {
    if (result.isSuccess) {
      if (isAuthenticated(result.data)) {
        router.push(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE));
      } else {
        router.refresh();
      }
    } else if (result.isError) {
      handleLogout();
    }
  }, [result]);

  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(authenticationSlice.actions.reset());
  }, []);

  return {
    handleLogin,
    verified,
    authenticating: result.isLoading || result.isSuccess,
  };
};

export const useLogout = () => {
  const router = useRouter();
  const [logout, result] = useLogoutMutation();

  const handleLogout = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    logout();
  };

  const dispatch = useAppDispatch();
  useEffect(() => {
    if (result.isSuccess || result.isError) {
      router.refresh();
      resetApplication(dispatch);
    }
  }, [result]);

  return {
    handleLogout,
    loggingOut: result.isLoading || result.isSuccess,
  };
};

export const useAuthentication = () => {
  const router = useRouter();
  const [logout, result] = useLogoutMutation();

  const {
    data,
    isLoading: authenticating,
    isSuccess: authenticated,
    isError,
  } = useGetAuthenticationQuery(undefined, {
    pollingInterval: 2700000,
  });

  useEffect(() => {
    if (isError) {
      logout();
    }
  }, [data]);

  useEffect(() => {
    if (result.isSuccess || result.isError) {
      router.push("/login");
    }
  }, [result]);

  return {
    data: data,
    authenticating,
    authenticated,
  };
};

export const useRegistry = () => {
  const { data, authenticated, authenticating } = useAuthentication();

  const {
    data: info,
    isLoading,
    isError,
  } = useGetDJInfoQuery(
    {
      cognito_user_name: (data as AuthenticatedUser)?.user?.username!,
    },
    {
      skip: !data || !authenticated || authenticating,
    }
  );

  return {
    loading: isLoading || authenticating || !authenticated,
    info: info,
  };
};
