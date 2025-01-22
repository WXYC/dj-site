import { SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import "server-only";
import { defaultApplicationState } from "./application/types";
import { defaultAuthenticationData } from "./authentication/utilities";
import { SiteProps } from "./types";

export const sessionOptions: SessionOptions = {
  cookieName: "app_session",
  password: String(process.env.SESSION_SECRET),
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  },
};

export const createServerSideProps = async (): Promise<SiteProps> => {
  const cookieStore = await cookies();

  return {
    application:
      JSON.parse(
        String(
          cookieStore.get("app_state")?.value ??
            JSON.stringify(defaultApplicationState)
        )
      ) ?? defaultApplicationState,
    authentication:
      JSON.parse(
        String(
          cookieStore.get("auth_state")?.value ??
            JSON.stringify(defaultAuthenticationData)
        )
      ) ?? defaultAuthenticationData,
  };
};
