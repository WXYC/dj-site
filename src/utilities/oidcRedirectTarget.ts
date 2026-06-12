/**
 * If `params` look like the search-param tail of an OIDC authorize bounce,
 * return the URL we should redirect to on successful sign-in so the OIDC
 * round-trip resumes. Returns `null` otherwise (the caller should fall back
 * to its default post-sign-in target, e.g. the dashboard).
 *
 * Contract — Better Auth's `oidcProvider` plugin (api.wxyc.org/auth):
 * authorize redirects an unauthenticated user to `${loginPage}?${original
 * query string}` and sets a signed `oidc_login_prompt` cookie (TTL 600s).
 * The loginPage's job is to authenticate the user and bounce back to
 * `${authBase}/oauth2/authorize?<original-query>`. Authorize re-runs, sees
 * the session cookie, issues the code, redirects to the client.
 *
 * Detection: require both `client_id` and `response_type=code` to be present.
 * That's the minimum signal that distinguishes an authorize bounce from a
 * plain `/login` visit (or the existing reset / verification / incomplete
 * flows, which use disjoint param names — `token`, `error`, `verified`,
 * `incomplete`). `response_type=token` (the OAuth implicit flow) is not
 * supported by `oidcProvider`, so we treat anything other than `code` as
 * a non-OIDC visit.
 */
export function getOidcRedirectTarget(
  params: URLSearchParams,
  authBaseUrl: string
): string | null {
  const clientId = params.get("client_id");
  const responseType = params.get("response_type");
  if (!clientId || responseType !== "code") {
    return null;
  }

  const base = authBaseUrl.replace(/\/+$/, "");
  return `${base}/oauth2/authorize?${params.toString()}`;
}
