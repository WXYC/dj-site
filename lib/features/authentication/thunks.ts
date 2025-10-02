import { createAsyncThunk } from "@reduxjs/toolkit";
import { Authorization } from "../admin/types";
import { User, BetterAuthUser, OrganizationRole } from "./types";
import { getSession } from "./client";

export const hydrateSession = createAsyncThunk(
  "authentication/hydrate",
  async () => {
    try {
      const session = await getSession();
      if (!session?.data?.user) return null;

      const user = session.data.user as BetterAuthUser;
      
      // Extract organization role from better-auth member data
      const organizationRole: OrganizationRole = user.member?.[0]?.role || "member";
      const organizationId = user.member?.[0]?.organizationId;
      
      return {
        id: user.id,
        username: user.username || user.email,
        email: user.email || "",
        realName: user.realName || "",
        djName: user.djName || "",
        authority: Authorization.DJ, // Keep for backward compatibility
        role: organizationRole, // New better-auth role
        organizationId,
        appSkin: user.appSkin || "modern-light",
      } as User;
    } catch (error) {
      console.warn(`[HydrateSession] Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
);
