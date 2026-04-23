import { getJWTToken } from "@/lib/features/authentication/client";

function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
}

/**
 * Get the URL for the library search proxy endpoint on Backend-Service.
 */
export function getLibrarySearchUrl(): string {
  return `${getBackendBaseUrl()}/proxy/library/search`;
}

/**
 * Build headers for authenticated requests to Backend-Service.
 * Reuses the JWT token cache from the auth client.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getJWTToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
