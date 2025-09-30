// Type definitions for better-auth with custom fields
declare module "better-auth" {
  interface User {
    realName?: string;
    djName?: string;
    appSkin?: string;
  }
}

declare module "better-auth/react" {
  interface User {
    realName?: string;
    djName?: string;
    appSkin?: string;
  }
}
