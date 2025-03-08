"use client";

import {
  useChangePasswordMutation,
  useGetAuthenticationQuery,
  useGetDJInfoQuery,
  useLoginMutation,
  useLogoutMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import {
  AuthenticatedUser,
  djAttributeNames,
  isAuthenticated,
  NewUserCredentials,
  VerifiedData,
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

export const useResetPassword = () => {
  const router = useRouter();

  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  const { handleLogout } = useLogout();

  const [changePassword, result] = useChangePasswordMutation();

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const username = e.currentTarget.username.value;
    const password = e.currentTarget.password.value;

    const params: NewUserCredentials = {
      username,
      password,
    };

    for (const attribute of Object.keys(djAttributeNames)) {
      const fieldName = djAttributeNames[attribute];
      if (e.currentTarget[fieldName].value) {
        params[attribute] = e.currentTarget[fieldName].value;
      }
    }

    changePassword(params);
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

  const addRequiredCredentials = (required: (keyof VerifiedData)[]) =>
    dispatch(authenticationSlice.actions.addRequiredCredentials(required));

  return {
    handleReset,
    verified,
    authenticating: result.isLoading || result.isSuccess,
    addRequiredCredentials,
  };
};
