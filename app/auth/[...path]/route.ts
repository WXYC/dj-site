/**
 * Reverse-proxy Route Handler for every `/auth/*` request.
 *
 * Replaces the `next.config.mjs` `/auth/:path*` rewrite. On the OpenNext /
 * Cloudflare Workers runtime that rewrite folds multiple `Set-Cookie` response
 * headers into a single header (opennextjs-cloudflare#501), which drops all but
 * the last cookie. better-auth legitimately emits several `Set-Cookie` headers
 * at once (sign-out clears session_token + session_data + dont_remember; a
 * re-login while a stale cookie is present sets the new token alongside a
 * dont_remember op), so the fold silently breaks sign-out and traps any browser
 * profile holding a stale cookie in a login loop.
 *
 * A Route Handler that streams the upstream response through and re-emits each
 * `Set-Cookie` header individually avoids the fold. The auth service sets
 * host-only cookies (no `Domain`), so proxying under the dj-site origin needs
 * no cookie rewriting — this is a faithful passthrough.
 */

const DEFAULT_AUTH_SERVICE_URL = "https://api.wxyc.org/auth";

// Connection-scoped (hop-by-hop) request headers a proxy must not forward
// (RFC 7230 §6.1) plus `host` (fetch sets it from the upstream URL). Forwarding
// `transfer-encoding` / `keep-alive` / `upgrade` also makes undici's `fetch`
// throw, so stripping them keeps the dev/E2E (Node) runtime working too.
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "te",
  "upgrade",
  "host",
];

/**
 * Where to forward `/auth/*` requests. `AUTH_REWRITE_URL` is the server-only
 * override (e.g. an internal container hostname); `NEXT_PUBLIC_BETTER_AUTH_URL`
 * is the browser-facing URL. Mirrors the resolution the old rewrite used. Any
 * trailing slash is trimmed so path joining can't produce a `//` that some
 * upstreams route as a distinct (404) path.
 */
function authServiceBaseUrl(): string {
  const base =
    process.env.AUTH_REWRITE_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    DEFAULT_AUTH_SERVICE_URL;
  return base.replace(/\/+$/, "");
}

async function proxyToAuthService(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path = [] } = await context.params;
  const base = authServiceBaseUrl();
  const search = new URL(request.url).search;
  const upstreamUrl = new URL(`${base}/${path.join("/")}${search}`);

  // Reverse-proxy hygiene: a segment that decodes to `..` (e.g. `%2e%2e`) would
  // let `new URL` normalize the path out of the `/auth` prefix and proxy an
  // arbitrary endpoint on the upstream host with the caller's cookies. Reject
  // anything that no longer resolves under the auth base path. A path-less base
  // (pathname "/") has no prefix to protect — every path is under the host root
  // — so only enforce the prefix when the base actually carries one.
  const basePathname = new URL(base).pathname;
  const escapesAuthPrefix =
    basePathname !== "/" &&
    upstreamUrl.pathname !== basePathname &&
    !upstreamUrl.pathname.startsWith(`${basePathname}/`);
  if (escapesAuthPrefix) {
    return new Response(null, { status: 404 });
  }

  const forwardedHeaders = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) forwardedHeaders.delete(header);
  // Ask the upstream for an uncompressed body. undici (Node: `next dev` / E2E)
  // auto-decompresses the body while leaving `content-encoding`/`content-length`
  // describing the compressed bytes, which would corrupt the passthrough. An
  // identity request avoids that as long as the upstream honors it (Express
  // `compression` and nginx do); on workerd, Cloudflare manages encoding itself.
  forwardedHeaders.set("accept-encoding", "identity");

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: forwardedHeaders,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  // Re-emit each Set-Cookie header individually. Copying via
  // `new Headers(upstream.headers)` can fold multiple Set-Cookie into one on
  // some runtimes, so strip and re-append them from getSetCookie(). Guard the
  // method's presence (some older Workers/OpenNext polyfills omit it) so an
  // absent getSetCookie degrades to the copied header rather than throwing.
  const responseHeaders = new Headers(upstream.headers);
  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  if (setCookies.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  proxyToAuthService as GET,
  proxyToAuthService as POST,
  proxyToAuthService as PUT,
  proxyToAuthService as PATCH,
  proxyToAuthService as DELETE,
  proxyToAuthService as OPTIONS,
  proxyToAuthService as HEAD,
};
