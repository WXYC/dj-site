import { cache } from "react";
import { cookies } from "next/headers";
import "server-only";
import { defaultApplicationState } from "./application/types";
import { defaultAuthenticationData, betterAuthSessionToAuthenticationData, BetterAuthSessionResponse, BetterAuthSession } from "./authentication/utilities";
import { getUserRoleInOrganization, getAppOrganizationId } from "./authentication/organization-utils";
import { mapRoleToAuthorization, isAuthenticated } from "./authentication/types";
import { SiteProps } from "./types";
import { serverAuthClient } from "./authentication/server-client";
import { parseAppSkinPreference } from "./experiences/preferences";

export const sessionOptions = {
  cookieOptions: {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  },
};

export const createServerSideProps = cache(async (): Promise<SiteProps> => {
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
    const session = await serverAuthClient
      .getSession({
        fetchOptions: {
          headers: {
            cookie: cookieHeader,
          },
        },
      })
      .catch((error) => {
        // Swallow auth-server fetch errors to avoid noisy Next.js errors.
        return { data: null, error } as BetterAuthSessionResponse;
      });

    if (session.data) {
      const normalizedSession = {
        ...session.data,
        user: {
          ...session.data.user,
          username: session.data.user.username ?? undefined,
          /* eslint-disable @typescript-eslint/no-explicit-any -- better-auth SDK getSession() response does not expose these fields in its type */
          role: (session.data.user as any).role ?? undefined,
          banned: (session.data.user as any).banned ?? undefined,
          banReason: (session.data.user as any).banReason ?? undefined,
          banExpires: (session.data.user as any).banExpires ?? undefined,
          /* eslint-enable @typescript-eslint/no-explicit-any */
        },
      } as BetterAuthSession;

      // Fetch organization role from APP_ORGANIZATION first
      const organizationId = getAppOrganizationId();
      if (organizationId) {
        try {
          const orgRole = await getUserRoleInOrganization(
            normalizedSession.user.id,
            organizationId,
            cookieHeader
          );
          
          if (orgRole !== undefined) {
            // Create authentication data with the fetched organization role
            const authority = mapRoleToAuthorization(orgRole);
            const authData = betterAuthSessionToAuthenticationData(normalizedSession);
            
            // If we have an authenticated user, update the authority with the organization role
            if (isAuthenticated(authData) && authData.user) {
              authData.user.authority = authority;
            }
            
            authentication = authData;
          } else {
            // User is not a member of the organization, use default (will have NO access)
            authentication = betterAuthSessionToAuthenticationData(normalizedSession);
          }
        } catch (error) {
          // If organization query fails, fall back to session-based role extraction
          console.warn("Failed to fetch organization role, using session data:", error);
          authentication = betterAuthSessionToAuthenticationData(normalizedSession);
        }
      } else {
        // No organization ID set, use session data
        authentication = betterAuthSessionToAuthenticationData(normalizedSession);
      }

      const appSkin = normalizedSession.user?.appSkin;
      const parsedPreference = parseAppSkinPreference(appSkin);
      if (parsedPreference) {
        appState = {
          ...appState,
          experience: parsedPreference.experience,
          colorMode: parsedPreference.colorMode,
        };
      }
    }
  } catch {
    // If better-auth session fetch fails, use default (not authenticated)
  }

  return {
    application: appState,
    authentication,
  };
});
