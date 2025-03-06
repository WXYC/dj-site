import { InitiateAuthCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import { jwtDecode } from "jwt-decode";
import { Authorization } from "../admin/types";
import { AuthenticationData, DJwtPayload, User } from "./types";

export const defaultAuthenticationData: AuthenticationData = {
  message: "Not Authenticated",
};

const requiredUserParameters = ["name", "custom:dj-name"];

export function toClient(data: InitiateAuthCommandOutput): AuthenticationData {
  if (
    data.ChallengeName === "NEW_PASSWORD_REQUIRED" &&
    data.ChallengeParameters
  ) {
    return {
      username: data.ChallengeParameters["USER_ID_FOR_SRP"],
      requiredAttributes: requiredUserParameters.filter(
        (attribute) => !data.ChallengeParameters![attribute]
      ),
    };
  } else if (
    data.AuthenticationResult &&
    data.AuthenticationResult.IdToken &&
    data.AuthenticationResult.AccessToken
  ) {
    return {
      user: toUser(data.AuthenticationResult.IdToken),
      accessToken: data.AuthenticationResult.AccessToken,
    };
  }

  return {};
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
