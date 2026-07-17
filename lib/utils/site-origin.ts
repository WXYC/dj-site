import "server-only";
import { headers } from "next/headers";

/**
 * The origin this request was served on. docs/adr/0007 records that dj-site
 * deliberately has no env-pinned canonical frontend origin — only the
 * backend/auth targets are env vars (NEXT_PUBLIC_BACKEND_URL etc., parsed
 * with next.config.mjs's originOf()). Production (dj.wxyc.org) and per-commit
 * preview deploys (*.wxyc-dj.pages.dev) share this codebase, so a hardcoded
 * or env-pinned origin would be wrong for previews; Cloudflare's routing
 * already pins the request Host to an account-owned hostname, making it the
 * correct and only available source. Same host-resolution precedence as
 * lib/features/session-guards.ts's servedHost().
 */
export async function getSiteOrigin(): Promise<string> {
  const headerList = await headers();
  // Multi-proxy chains append comma-separated values; `||` (not `??`) so an
  // empty-after-trim first entry falls through instead of yielding "https://".
  const forwardedHost = headerList
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim();
  const host = forwardedHost || headerList.get("host") || "localhost:3000";

  const forwardedProto = headerList
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}
