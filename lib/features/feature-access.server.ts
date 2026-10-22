import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { FeatureAccessEntry, FeatureAccessResponse, FeatureAudience } from "@wxyc/shared";
import { getServerJwtTokenCached } from "./authentication/server-token";
import { fetchBackendJson } from "./server-fetch";

const AUDIENCES: readonly FeatureAudience[] = ["off", "staff", "everyone"];

/** The answer for every failure: the screens stay hidden. */
export const NO_FEATURE_ACCESS: FeatureAccessEntry = { audience: "off", can_see: false };

function isFeatureAccessEntry(value: unknown): value is FeatureAccessEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { audience, can_see } = value as Record<string, unknown>;
  return typeof can_see === "boolean" && AUDIENCES.includes(audience as FeatureAudience);
}

/**
 * Whether the signed-in account may see the review screens, and who the
 * Backend opens them to, from `GET /feature-access`. The Backend alone decides
 * both: the DJ site holds no flag of its own. Read once per request (React
 * `cache()`), with a server-minted bearer, and never cached longer, as the
 * contract requires.
 *
 * Fails closed: no token, no Backend URL, a timeout, a non-2xx, or a body that
 * is not a known entry all answer {@link NO_FEATURE_ACCESS}.
 */
export const getReviewsAccess = cache(async (): Promise<FeatureAccessEntry> => {
  try {
    const token = await getServerJwtTokenCached((await cookies()).toString());
    if (!token) {
      return NO_FEATURE_ACCESS;
    }
    const body = await fetchBackendJson<Partial<FeatureAccessResponse>>("/feature-access", {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return isFeatureAccessEntry(body.reviews)
      ? { audience: body.reviews.audience, can_see: body.reviews.can_see }
      : NO_FEATURE_ACCESS;
  } catch {
    return NO_FEATURE_ACCESS;
  }
});
