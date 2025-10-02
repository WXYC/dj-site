// Type definitions for better-auth with custom fields and organization support
declare module "better-auth" {
  interface User {
    realName?: string;
    djName?: string;
    appSkin?: string;
    onboarded?: boolean;
    member?: {
      id: string;
      organizationId: string;
      userId: string;
      role: "member" | "dj" | "music-director" | "admin";
      createdAt: Date;
    }[];
  }
}

declare module "better-auth/react" {
  interface User {
    realName?: string;
    djName?: string;
    appSkin?: string;
    onboarded?: boolean;
    member?: {
      id: string;
      organizationId: string;
      userId: string;
      role: "member" | "dj" | "music-director" | "admin";
      createdAt: Date;
    }[];
  }
}
