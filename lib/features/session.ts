import { cookies } from "next/headers";
import "server-only";
import { defaultApplicationState } from "./application/types";
import { defaultAuthenticationData, betterAuthSessionToAuthenticationData, BetterAuthSessionResponse } from "./authentication/utilities";
import { getUserRoleInOrganization, getAppOrganizationId } from "./authentication/organization-utils";
import { mapRoleToAuthorization, isAuthenticated, AuthenticatedUser } from "./authentication/types";
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
      // Fetch organization role from APP_ORGANIZATION first
      const organizationId = getAppOrganizationId();
      if (organizationId) {
        try {
          const orgRole = await getUserRoleInOrganization(
            session.data.user.id,
            organizationId,
            cookieHeader
          );
          
          if (orgRole !== undefined) {
            // Create authentication data with the fetched organization role
            const authority = mapRoleToAuthorization(orgRole);
            const authData = betterAuthSessionToAuthenticationData(session.data);
            
            // If we have an authenticated user, update the authority with the organization role
            if (isAuthenticated(authData) && authData.user) {
              authData.user.authority = authority;
            }
            
            authentication = authData;
          } else {
            // User is not a member of the organization, use default (will have NO access)
            authentication = betterAuthSessionToAuthenticationData(session.data);
          }
        } catch (error) {
          // If organization query fails, fall back to session-based role extraction
          console.warn("Failed to fetch organization role, using session data:", error);
          authentication = betterAuthSessionToAuthenticationData(session.data);
        }
      } else {
        // No organization ID set, use session data
        authentication = betterAuthSessionToAuthenticationData(session.data);
      }
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
