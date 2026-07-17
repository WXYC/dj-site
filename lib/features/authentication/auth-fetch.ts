/**
 * Shared request plumbing for the WXYC auth service (better-auth). Base-URL
 * resolution differs between browser and server, so the environment-specific
 * variants (`authFetch` in client.ts, `serverAuthFetch` in server-client.ts)
 * inject the base URL here. This module stays free of any client- or
 * server-only import so both variants can share it without dragging React or
 * the `server-only` tripwire across the boundary.
 */

export type AuthFetchInit = RequestInit & {
  /** Serialized to a JSON body with a matching Content-Type header when set. */
  json?: unknown;
};

export type AuthResult<T> = {
  ok: boolean;
  status: number;
  /** Parsed JSON body, or null when the body was absent or not JSON. */
  data: T | null;
};

export async function authFetchWithBase<T>(
  baseURL: string,
  path: string,
  init: AuthFetchInit = {},
): Promise<AuthResult<T>> {
  const { json, headers, body, ...rest } = init;
  const finalHeaders = new Headers(headers);
  let finalBody = body;
  if (json !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(json);
  }

  const response = await fetch(`${baseURL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
  });

  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    // A non-JSON or empty body is a valid outcome for several auth endpoints;
    // callers decide what a null body means for their case.
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * Extract a user-facing message from an auth-service error body, preferring the
 * `error` field over `message`, falling back to a caller-supplied default.
 */
export function authErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const payload = data as { error?: unknown; message?: unknown };
    if (typeof payload.error === "string" && payload.error) return payload.error;
    if (typeof payload.message === "string" && payload.message) return payload.message;
  }
  return fallback;
}
