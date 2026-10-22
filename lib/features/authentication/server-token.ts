import "server-only";
import { cache } from "react";
import { getServerJwtToken } from "./server-client";

/**
 * {@link getServerJwtToken} memoized for the length of one server request
 * (React `cache()`, keyed on the cookie header). The role read and the
 * feature-access read of a single dashboard render both need the same bearer,
 * so they share one `/token` round trip instead of minting two. Nothing is
 * kept across requests.
 */
export const getServerJwtTokenCached = cache((cookieHeader?: string) => getServerJwtToken(cookieHeader));
