import { cache } from "react";
import { cookies } from "next/headers";
import "server-only";
import { defaultApplicationState } from "./application/types";
import { defaultAuthenticationData, betterAuthSessionToAuthenticationData, BetterAuthSessionResponse, BetterAuthSession } from "./authentication/utilities";
import { getUserRoleInOrganization, getAppOrganizationId } from "./authentication/organization-utils.server";
import { roleToAuthorization, isAuthenticated, AuthenticatedUser } from "./authentication/types";
import { SiteProps } from "./types";
import { serverAuthClient } from "./authentication/server-client";
import { parseAppSkinPreference } from "./experiences/preferences";

export const sessionOptions = {
  cookieOptions: {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    // app_state carries UI preference state only; the client reads it through
    // the /api/view GET route (see src/hooks/themePreferenceHooks.ts), never
    // document.cookie, so it never needs to be script-readable.
    httpOnly: true,
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

  let authentication = defaultAuthenticationData;
  try {
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
          role: (session.data.user as any).role ?? undefined,
          banned: (session.data.user as any).banned ?? undefined,
          banReason: (session.data.user as any).banReason ?? undefined,
          banExpires: (session.data.user as any).banExpires ?? undefined,
        },
      } as BetterAuthSession;

      const organizationId = getAppOrganizationId();
      if (organizationId) {
        try {
          const orgRole = await getUserRoleInOrganization(
            normalizedSession.user.id,
            organizationId,
            cookieHeader
          );

          if (orgRole !== undefined) {
            const authority = roleToAuthorization(orgRole);
            const authData = betterAuthSessionToAuthenticationData(normalizedSession);

            if (isAuthenticated(authData) && authData.user) {
              authData.user.authority = authority;
            }

            authentication = authData;
          } else {
            // User is not a member of the organization, use default (will have NO access)
            authentication = betterAuthSessionToAuthenticationData(normalizedSession);
          }
        } catch (error) {
          console.warn("Failed to fetch organization role, using session data:", error);
          authentication = betterAuthSessionToAuthenticationData(normalizedSession);
        }
      } else {
        authentication = betterAuthSessionToAuthenticationData(normalizedSession);
      }

      const appSkin = normalizedSession.user?.appSkin;
      const parsedPreference = parseAppSkinPreference(appSkin);
      if (parsedPreference) {
        appState = {
          ...appState,
          experience: parsedPreference.experience,
          colorMode: parsedPreference.colorMode,
          themeId: parsedPreference.themeId,
        };
      }
    }
  } catch {
    // no-op: default (unauthenticated) authentication is used
  }

  return {
    application: appState,
    authentication,
  };
});
