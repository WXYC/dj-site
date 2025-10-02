import { cookies } from "next/headers";
import { Authorization } from "../admin/types";
import { AppSkin, ServerSideProps, isValidAppSkin, BetterAuthUser, User, OrganizationRole, authorizationToRole } from "./types";

export const defaultSession = {
  user: null,
  loading: false,
} as const;

export async function getAppSkin(): Promise<AppSkin> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_AUTH_URL}/session`, {
      headers: {
        cookie: (await cookies()).toString(),
      },
      credentials: "include",
    });

    if (res.ok) {
      const { session } = await res.json();
      if (session?.user?.appSkin && isValidAppSkin(session.user.appSkin)) {
        return session.user.appSkin;
      }
    } else {
      console.warn(
        `[AppSkin] Auth server returned ${res.status} ${res.statusText} - using fallback`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        console.warn(
          `[AppSkin] Network error connecting to auth server - using fallback`
        );
      } else {
        console.warn(
          `[AppSkin] Error fetching session: ${error.message} - using fallback`
        );
      }
    } else {
      console.warn(`[AppSkin] Unknown error fetching session - using fallback`);
    }
  }

  try {
    const cookieStore = await cookies();
    const appSkinCookie = cookieStore.get("appSkin");
    if (appSkinCookie?.value && isValidAppSkin(appSkinCookie.value)) {
      return appSkinCookie.value;
    }
  } catch (error) {
    console.warn(
      `[AppSkin] Error reading cookie: ${
        error instanceof Error ? error.message : "Unknown error"
      } - using default`
    );
  }

  return "modern-light";
}

export async function getServerSideProps(): Promise<ServerSideProps> {
  const appSkin = await getAppSkin();

  // Get authentication data
  let authentication = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_AUTH_URL}/session`, {
      headers: {
        cookie: (await cookies()).toString(),
      },
      credentials: "include",
    });

    if (res.ok) {
      const { session } = await res.json();
      if (session?.user) {
        const user = session.user as BetterAuthUser;
        
        // Extract organization role from better-auth member data
        const organizationRole: OrganizationRole = user.member?.[0]?.role || "member";
        const organizationId = user.member?.[0]?.organizationId;
        
        // Create authenticated user data
        authentication = {
          user: {
            id: user.id,
            username: user.username || user.email,
            email: user.email || "",
            realName: user.realName || "",
            djName: user.djName || "",
            authority: Authorization.DJ, // Keep for backward compatibility
            role: organizationRole, // New better-auth role
            organizationId,
            appSkin:
              user.appSkin && isValidAppSkin(user.appSkin)
                ? (user.appSkin as AppSkin)
                : "modern",
          } as User,
        };
      }
    } else {
      console.warn(
        `[Auth] Auth server returned ${res.status} ${res.statusText} - no user session`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        console.warn(
          `[Auth] Network error connecting to auth server - no user session`
        );
      } else {
        console.warn(
          `[Auth] Error fetching authentication: ${error.message} - no user session`
        );
      }
    } else {
      console.warn(
        `[Auth] Unknown error fetching authentication - no user session`
      );
    }
  }

  return {
    application: {
      appSkin,
    },
    authentication,
  };
}
