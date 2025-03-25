"use client";

import {
  useGetAuthenticationQuery,
  useGetDJInfoQuery,
  useLoginMutation,
  useLogoutMutation,
  useNewUserMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import {
  AuthenticatedUser,
  djAttributeNames,
  isAuthenticated,
  NewUserCredentials,
  ResetPasswordRequest,
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

export const useNewUser = () => {
  const router = useRouter();

  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  const { handleLogout } = useLogout();

  const [setNewUserData, result] = useNewUserMutation();

  const handleNewUser = async (e: React.FormEvent<HTMLFormElement>) => {
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

    setNewUserData(params);
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
    handleNewUser,
    verified,
    authenticating: result.isLoading || result.isSuccess,
    addRequiredCredentials,
  };
};

export const useResetPassword = () => {
  const router = useRouter();
  const { handleLogout } = useLogout();

  const [makeForgotRequest, forgotResult] = useRequestPasswordResetMutation();

  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  // button clicked
  const handleRequestReset = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const username = e.currentTarget.form?.username.value;
    if (!username) return;

    makeForgotRequest(String(username));
  };

  useEffect(() => {
    if (forgotResult.isSuccess) {
      router.refresh();
    } else if (forgotResult.isError) {
      handleLogout();
    }
  }, [forgotResult]);

  const [resetPassword, resetResult] = useResetPasswordMutation();

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const code = e.currentTarget.code.value;
    const password = e.currentTarget.password.value;
    const username = e.currentTarget.username.value;

    if (!code || !password || !username) return;

    const params: ResetPasswordRequest = { code, password, username };

    resetPassword(params);
  }

  useEffect(() => {
    if (resetResult.isSuccess) {
      if (isAuthenticated(resetResult.data)) {
        router.push(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE));
      } else {
        router.refresh();
      }
    } else if (resetResult.isError) {
      handleLogout();
    }
  }, [resetResult]);

  return {
    handleReset,
    handleRequestReset,
    verified,
    requestingReset: forgotResult.isLoading || forgotResult.isSuccess,
  };
};
