"use client";

import {
  useGetAuthenticationQuery,
  useGetDJInfoQuery,
  useLoginMutation,
  useLogoutMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
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
      router.push(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE));
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
      router.push("/login");
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
    user: data?.user,
    authenticating,
    authenticated,
  };
};

export const useRegistry = () => {
  const { user, authenticated, authenticating } = useAuthentication();

  const { data, isLoading, isError } = useGetDJInfoQuery(
    {
      cognito_user_name: user?.username!,
    },
    {
      skip: !user || !authenticated || authenticating,
    }
  );

  return {
    loading: isLoading || authenticating || !authenticated,
    info: data,
  };
};
