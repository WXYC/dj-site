import { cookies } from "next/headers";
import "server-only";
import { defaultApplicationState } from "./application/types";
import { defaultAuthenticationData, betterAuthSessionToAuthenticationData, BetterAuthSessionResponse } from "./authentication/utilities";
import { SiteProps } from "./types";
import { serverAuthClient } from "./authentication/server-client";

export const runtime = "edge";

export const createServerSideProps = async (): Promise<SiteProps> => {
  const cookieStore = await cookies();

  const appStateValue = cookieStore.get("app_state")?.value;
  let appState = defaultApplicationState;
  
  if (appStateValue) {
    try {
      const parsed = JSON.parse(appStateValue);
      // Migrate old 'classic' boolean to new 'experience' string
      if (parsed && typeof parsed === "object") {
        if ("classic" in parsed && !("experience" in parsed)) {
          appState = {
            ...defaultApplicationState,
            ...parsed,
            experience: parsed.classic ? "classic" : "modern",
          };
        } else {
          appState = { ...defaultApplicationState, ...parsed };
        }
      }
    } catch (e) {
      console.error("Failed to parse app_state cookie", e);
    }
  }

  // Get better-auth session
  let authentication = defaultAuthenticationData;
  try {
    // Get all cookies as a string for better-auth client
    const cookieHeader = cookieStore.toString();
    const session = await serverAuthClient.getSession({
      fetchOptions: {
        headers: {
          cookie: cookieHeader,
        },
      },
    }) as BetterAuthSessionResponse;

    if (session.data) {
      authentication = betterAuthSessionToAuthenticationData(session.data);
    }
  } catch (error) {
    // If better-auth session fetch fails, use default (not authenticated)
    console.error("Failed to get better-auth session:", error);
  }

  return {
    application: appState,
    authentication,
  };
};
