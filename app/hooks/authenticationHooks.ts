"use client";

import {
  useLoginMutation,
  useLogoutMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/slice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const useLogin = () => {
  const router = useRouter();

  const verified = useAppSelector(
    authenticationSlice.selectors.allCredentialsVerified
  );

  const [login, result] = useLoginMutation();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const username = e.currentTarget.username.value;
    const password = e.currentTarget.password.value;

    login({ username, password });
  };

  useEffect(() => {
    if (result.isSuccess) {
      router.push("/dashboard");
    }
  }, [result]);

  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(authenticationSlice.actions.reset());
  }, []);

  return {
    handleLogin,
    verified,
    authenticating: result.isLoading,
  };
};

export const useLogout = () => {
  const router = useRouter();
  const [logout, result] = useLogoutMutation();

  const handleLogout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    logout();
  };

  useEffect(() => {
    if (result.isSuccess) {
      router.push("/login");
    }
  }, [result]);

  return {
    handleLogout,
    loggingOut: result.isLoading,
  };
};
