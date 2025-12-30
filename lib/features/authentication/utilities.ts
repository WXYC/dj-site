import { jwtDecode } from "jwt-decode";
import { Authorization } from "../admin/types";
import { 
  AuthenticationData, 
  AuthenticatedUser,
  BetterAuthJwtPayload,
  mapRoleToAuthorization,
  User
} from "./types";

// Better-auth session type (from better-auth client)
export type BetterAuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    username?: string;
    emailVerified: boolean;
    realName?: string;
    djName?: string;
    appSkin?: string;
    createdAt?: Date;
    updatedAt?: Date;
    role?: string;  // Base user role (e.g., "user")
    banned?: boolean;
    banReason?: string | null;
    banExpires?: Date | null;
    displayUsername?: string | null;
    image?: string | null;
    // Organization member data (if using organizationClient)
    organization?: {
      id: string;
      name: string;
      role?: string;  // Organization member role (e.g., "member", "dj", "musicDirector", "stationManager")
    };
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token?: string;  // Session ID (not a JWT token)
    activeOrganizationId?: string | null;  // Active organization ID if user is part of an organization
  };
};

// Better-auth session response type (from getSession() call)
export type BetterAuthSessionResponse = {
  data: BetterAuthSession | null;
  error?: {
    message: string;
    code?: string;
  };
};

export const defaultAuthenticationData: AuthenticationData = {
  message: "Not Authenticated",
};


// Convert better-auth JWT token to User
export function toUserFromBetterAuthJWT(token: string): User {
  const decodedToken = jwtDecode<BetterAuthJwtPayload>(token);

  return {
    id: decodedToken.id || decodedToken.sub,
    username: decodedToken.email.split("@")[0] || decodedToken.id || "", // Fallback if username not in token
    email: decodedToken.email,
    authority: mapRoleToAuthorization(decodedToken.role),
    // Additional fields would need to be fetched from session/user object
  };
}

// Convert better-auth session to AuthenticationData format
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/a0b0c584-4e13-42f0-9bc9-82a7db02d9db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utilities.ts:61',message:'betterAuthSessionToAuthenticationData entry',data:{hasSession:!!session,hasUser:!!session?.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/a0b0c584-4e13-42f0-9bc9-82a7db02d9db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utilities.ts:68',message:'Session user structure',data:{sessionUser:session.user,hasToken:!!session.session?.token,tokenLength:session.session?.token?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // Get role from organization member data (if available) or user role
  // Organization role takes precedence over base user role
  // Also check if role is stored in metadata or other custom fields
  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  // Check for role in metadata or other potential locations
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/a0b0c584-4e13-42f0-9bc9-82a7db02d9db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utilities.ts:77',message:'Role extraction - all sources',data:{organizationRole:organizationRole,userRole:userRole,metadataRole:metadataRole,customRole:customRole,roleToMap:roleToMap,allUserKeys:Object.keys(session.user)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'S'})}).catch(()=>{});
  // #endregion

  const token = session.session?.token;
  const authority = mapRoleToAuthorization(roleToMap);

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/a0b0c584-4e13-42f0-9bc9-82a7db02d9db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utilities.ts:82',message:'Mapped authority',data:{roleToMap:roleToMap,authority:authority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  const user: User = {
    id: session.user.id,
    username: session.user.username || session.user.name,
    email: session.user.email,
    realName: session.user.realName,
    djName: session.user.djName,
    authority: authority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/a0b0c584-4e13-42f0-9bc9-82a7db02d9db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utilities.ts:96',message:'Final user object',data:{user:user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  return {
    user,
    accessToken: token,
    token: token, // Session ID (not a JWT)
  } as AuthenticatedUser;
}
