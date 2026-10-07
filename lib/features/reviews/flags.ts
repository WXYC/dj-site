import { Authorization } from "@/lib/features/admin/types";

/**
 * Reviews feature flag read from a public Next.js env var.
 *
 * The value is inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init. This module is the only reader of
 * `NEXT_PUBLIC_REVIEWS_ENABLED`; everything else asks `canSeeReviews`.
 */

export type ReviewsAudience = "off" | "staff" | "everyone";

/**
 * Who the flag opens the reviews screens to. `staff` and `true`/`1` turn it
 * on; unset, empty, or any other value is off.
 */
export function reviewsAudience(): ReviewsAudience {
  const envValue = process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
  if (envValue === "staff") return "staff";
  if (envValue === "true" || envValue === "1") return "everyone";
  return "off";
}

/**
 * Whether an account with this authorization is shown the reviews screens.
 * Hides screens only: Backend-Service serves the review routes either way.
 * A signed-out account (`Authorization.NO`) never sees them.
 */
export function canSeeReviews(authorization: Authorization): boolean {
  if (authorization < Authorization.DJ) return false;
  switch (reviewsAudience()) {
    case "everyone":
      return true;
    case "staff":
      return authorization >= Authorization.MD;
    default:
      return false;
  }
}
