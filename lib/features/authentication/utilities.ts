import { jwtDecode } from "jwt-decode";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Authorization } from "../admin/types";
import {
  AuthenticationData,
  AuthenticationStage,
  DJwtPayload,
  User,
} from "./types";

export const defaultAuthenticationData: AuthenticationData = {
  stage: AuthenticationStage.NotAuthenticated,
  user: undefined,
};

export function toClient(
  stage: AuthenticationStage,
  idToken?: string,
  accessToken?: string
): AuthenticationData {
  return {
    stage: stage,
    user:
      idToken && accessToken && stage === AuthenticationStage.Authenticated
        ? toUser(idToken)
        : undefined,
    accessToken:
      accessToken && idToken && stage === AuthenticationStage.Authenticated
        ? accessToken
        : undefined,
  };
}

export function toUser(token: string): User {
  const decodedToken = jwtDecode<DJwtPayload>(token);

  return {
    username: decodedToken["cognito:username"],
    email: decodedToken["email"],
    realName: decodedToken["name"],
    djName: decodedToken["custom:dj-name"],
    authority: decodedToken["cognito:groups"]?.includes("station-management")
      ? Authorization.SM
      : decodedToken["cognito:groups"]?.includes("music-directors")
      ? Authorization.MD
      : Authorization.DJ,
  };
}