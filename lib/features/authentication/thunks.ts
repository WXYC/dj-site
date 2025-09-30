import { createAsyncThunk } from "@reduxjs/toolkit";
import { Authorization } from "../admin/types";
import { User, BetterAuthUser } from "./types";
import { getSession } from "./client";

export const hydrateSession = createAsyncThunk(
  "authentication/hydrate",
  async () => {
    try {
      const session = await getSession();
      if (!session?.data?.user) return null;

      const user = session.data.user as BetterAuthUser;
      
      return {
        id: user.id,
        username: user.username || user.email,
        email: user.email || "",
        realName: user.realName || "",
        djName: user.djName || "",
        authority: Authorization.DJ,
        appSkin: user.appSkin || "modern-light",
      } as User;
    } catch (error) {
      console.warn(`[HydrateSession] Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
);
