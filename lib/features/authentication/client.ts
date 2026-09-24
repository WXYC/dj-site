"use client";

import { createAuthClient } from "better-auth/react"
import { adminClient, emailOTPClient, usernameClient, jwtClient, organizationClient } from "better-auth/client/plugins"
import { isValidEmail } from "@wxyc/shared/validation"
import { authErrorMessage, authFetchWithBase, type AuthFetchInit, type AuthResult } from "./auth-fetch"

function getBaseURL(): string {
  // Client-side: prefer same-origin proxy to ensure session cookies are set
  const envURL = process?.env?.NEXT_PUBLIC_BETTER_AUTH_URL;

  if (typeof window !== "undefined") {
    if (envURL) {
      try {
        const url = new URL(envURL);
        if (url.origin !== window.location.origin) {
          return `${window.location.origin}/auth`;
        }
        return envURL;
      } catch {
        return envURL.startsWith("/")
          ? `${window.location.origin}${envURL}`
          : `${window.location.origin}/auth`;
      }
    }

    return `${window.location.origin}/auth`;
  }

  return envURL || "https://api.wxyc.org/auth";
}

const baseURL = getBaseURL();
export { baseURL as authBaseURL };

/**
 * Typed gateway for browser-side auth-service requests. Resolves the path
 * against the auth base URL and sends the session cookie by default (the
 * same-origin proxy relies on it); a caller can override `credentials`.
 */
export function authFetch<T = unknown>(
  path: string,
  init: AuthFetchInit = {},
): Promise<AuthResult<T>> {
  return authFetchWithBase<T>(baseURL, path, { credentials: "include", ...init });
}

const baseConfig = {
    baseURL,
    fetchOptions: {
        credentials: "include" as RequestCredentials,
    },
    plugins: [
        adminClient(),
        emailOTPClient(),
        usernameClient(),
        jwtClient(),
        organizationClient(),
    ]
};

export const authClient = createAuthClient(baseConfig);

let cachedToken: string | null = null;
let cacheExpiry = 0;
let inflight: Promise<string | null> | null = null;
const TOKEN_CACHE_MS = 4 * 60 * 1000;

async function fetchJWTToken(): Promise<string | null> {
  try {
    const { ok, data } = await authFetch<{ token?: string | null }>("/token", {
      method: "GET",
    });

    if (!ok) {
      return null;
    }

    return data?.token || null;
  } catch (error) {
    console.error("Failed to get JWT token:", error);
    return null;
  }
}

/**
 * Get JWT token from better-auth /token endpoint.
 * Caches the token for 4 minutes and deduplicates concurrent requests.
 */
export async function getJWTToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cacheExpiry) {
    return cachedToken;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetchJWTToken().then((token) => {
    cachedToken = token;
    cacheExpiry = token ? Date.now() + TOKEN_CACHE_MS : 0;
    inflight = null;
    return token;
  });

  return inflight;
}

export function clearTokenCache(): void {
  cachedToken = null;
  cacheExpiry = 0;
  inflight = null;
}

/**
 * Resolve a login identifier (username or email) to an email address.
 * Returns the email when the username matches a user; returns the
 * identifier unchanged when it already contains '@'; returns null when
 * a username has no match. Rate-limited by the auth server.
 */
export async function lookupEmailByIdentifier(identifier: string): Promise<string | null> {
  if (isValidEmail(identifier)) {
    return identifier;
  }

  // Unauthenticated public lookup: no session cookie is sent.
  const { ok, data } = await authFetch<{ email?: string | null }>("/wxyc/lookup-email", {
    method: "POST",
    credentials: "same-origin",
    json: { identifier },
  });

  if (!ok) {
    return null;
  }

  return data?.email ?? null;
}

export type StationSignupRequest = {
  passcode: string;
  username: string;
  email: string;
  password: string;
  realName: string;
  djName?: string;
};

export type StationSignupErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_USERNAME"
  | "INVALID_EMAIL"
  | "WEAK_PASSWORD"
  | "PASSWORD_TOO_LONG"
  | "INVALID_PASSCODE"
  | "COOLDOWN"
  | "EMAIL_TAKEN"
  | "USERNAME_TAKEN";

export type StationSignupOutcome =
  | { status: "success"; username: string; email: string }
  // The server-side flag is off. better-auth's catch-all answers this with a
  // bare 404 and no JSON body, so this carries no message of its own — the
  // caller owns the "not available" copy, same as any other client-owned string.
  | { status: "unavailable" }
  | { status: "error"; code?: StationSignupErrorCode; message: string };

type StationSignupSuccessPayload = { username?: string; email?: string };
type StationSignupErrorPayload = { error?: string; message?: string; code?: string };

/**
 * Submit a station-signup passcode plus the DJ's chosen account details.
 * Unauthenticated pre-session call, so no session cookie is sent (matching
 * `lookupEmailByIdentifier`).
 *
 * Never distinguishes a wrong passcode from an expired one — both answer with
 * the same 401 `INVALID_PASSCODE`, byte-identical, by server design. Callers
 * must not try to tell them apart either.
 */
export async function stationSignup(
  request: StationSignupRequest
): Promise<StationSignupOutcome> {
  const { ok, status, data } = await authFetch<
    StationSignupSuccessPayload | StationSignupErrorPayload
  >("/wxyc/station-signup", {
    method: "POST",
    credentials: "same-origin",
    json: request,
  });

  if (status === 404) {
    return { status: "unavailable" };
  }

  if (ok) {
    const success = (data as StationSignupSuccessPayload) ?? {};
    return {
      status: "success",
      username: success.username ?? request.username,
      email: success.email ?? request.email,
    };
  }

  const errorPayload = data as StationSignupErrorPayload | null;
  return {
    status: "error",
    code: errorPayload?.code as StationSignupErrorCode | undefined,
    message: authErrorMessage(data, "Signup failed. Please try again."),
  };
}

export type UpdateIdentityRequest = {
  realName?: string;
  djName?: string;
};

export type UpdateIdentityResponse = {
  status: true;
  userId: string;
  realName?: string;
  djName?: string;
};

/**
 * Update the signed-in DJ's own personal name / on-air handle.
 *
 * These two fields do NOT go through `authClient.updateUser`. Backend-Service
 * locks them to `input: false` in better-auth's `user.additionalFields`, so
 * the public `POST /auth/update-user` answers
 * `400 {"code":"FIELD_NOT_ALLOWED","message":"djName is not allowed to be set"}`
 * for either of them. The dedicated endpoint writes the same two columns
 * through an allowlist, scoped to the session's own row.
 *
 * Throws on a non-2xx, matching `completeOnboarding` — `useDJAccount`'s catch
 * is what turns it into a toast, and a rejected write must never reach the
 * success path.
 */
export async function updateIdentity(
  body: UpdateIdentityRequest,
): Promise<UpdateIdentityResponse> {
  const { ok, data } = await authFetch<
    UpdateIdentityResponse | { error?: string; message?: string }
  >("/wxyc/update-identity", {
    method: "POST",
    json: body,
  });

  if (!ok) {
    throw new Error(authErrorMessage(data, "Failed to update your profile"));
  }

  return data as UpdateIdentityResponse;
}

export type CompleteOnboardingRequest = {
  token?: string;
  newPassword?: string;
  realName?: string;
  djName?: string;
};

export type CompleteOnboardingResponse = {
  status: true;
  userId: string;
  email: string;
  username?: string;
};

type CompleteOnboardingErrorPayload = {
  error?: string;
  message?: string;
};

/**
 * Complete onboarding for an admin-provisioned DJ (invite token or session).
 */
export async function completeOnboarding(
  body: CompleteOnboardingRequest
): Promise<CompleteOnboardingResponse> {
  const { ok, data } = await authFetch<
    CompleteOnboardingResponse | CompleteOnboardingErrorPayload
  >("/wxyc/complete-onboarding", {
    method: "POST",
    json: body,
  });

  if (!ok) {
    throw new Error(authErrorMessage(data, "Failed to complete onboarding"));
  }

  return data as CompleteOnboardingResponse;
}
