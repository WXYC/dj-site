import type { ReadonlyURLSearchParams } from "next/navigation";

/** The one query key the station-signup detour owns. */
const SIGNUP_PARAM = "signup";

/**
 * `/login` hrefs for the station-signup detour, built from the query string
 * that is already on screen.
 *
 * `/login` is not only the login screen: it is where Better Auth's OIDC
 * `authorize` endpoint parks an unauthenticated DJ, with the whole authorize
 * query (`client_id`, `response_type`, `redirect_uri`, `state`, ...) intact,
 * and `useLogin` recomputes the resume target from the LIVE `useSearchParams()`
 * at sign-in time — see `getOidcRedirectTarget` and #762/#836. Any navigation
 * within `/login` that replaces the URL with a bare path therefore breaks the
 * relying party's round-trip silently: the DJ signs in, lands on the dashboard,
 * and the client never receives its code.
 *
 * So both directions of the detour edit exactly one key, `signup`, and carry
 * everything else through untouched.
 *
 * Params are typed `URLSearchParams | ReadonlyURLSearchParams` so a call site
 * can hand the value from `useSearchParams()` straight in; `null`/`undefined`
 * are accepted because `useSearchParams()` is nullable in a client component
 * rendered outside a router context.
 */
type MaybeParams = URLSearchParams | ReadonlyURLSearchParams | null | undefined;

function toLoginHref(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

function clone(params: MaybeParams): URLSearchParams {
  return new URLSearchParams(params?.toString() ?? "");
}

/**
 * Whether the query carries the signup detour marker, `signup=1` exactly.
 * Callers still gate on `isStationSignupEnabled()` — the flag decides whether
 * the marker means anything; this only owns the key and value.
 */
export function hasSignupParam(params: MaybeParams): boolean {
  return params?.get(SIGNUP_PARAM) === "1";
}

/**
 * The href of the "Sign up here" entry link: the current params
 * plus `signup=1`.
 */
export function loginHrefWithSignup(params: MaybeParams): string {
  const next = clone(params);
  next.set(SIGNUP_PARAM, "1");
  return toLoginHref(next);
}

/**
 * The href to back out of station signup: the current params minus `signup`.
 * Falls back to a bare `/login` only when nothing else was in the query.
 */
export function loginHrefWithoutSignup(params: MaybeParams): string {
  const next = clone(params);
  next.delete(SIGNUP_PARAM);
  return toLoginHref(next);
}
