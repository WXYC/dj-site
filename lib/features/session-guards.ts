import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "./authentication/server-utils";

// The host we were served on, as reported by the edge/proxy. Cloudflare Pages
// (and local dev) set `host`; a fronting proxy may instead set
// `x-forwarded-host`. Deriving the expected origin from the request itself keeps
// the check correct across production, localhost, and per-commit preview deploys
// without hardcoding a host.
function servedHost(request: NextRequest): string | null {
  // Trusting x-forwarded-host assumes the edge (Cloudflare) overwrites any
  // inbound value; a direct request spoofing it carries no victim session
  // cookie, and the session requirement below backstops it.
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) {
    // Multi-proxy chains may append a comma-separated list; the first entry is
    // the client-facing host.
    return forwarded.split(",")[0].trim().toLowerCase();
  }
  return request.headers.get("host")?.toLowerCase() ?? null;
}

function hostOf(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    // `host` includes any explicit port — the port is part of the origin
    // boundary, so a hostname-only comparison would wrongly admit a different
    // port on the same machine.
    return new URL(headerValue).host.toLowerCase();
  } catch {
    return null;
  }
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Guard for POST routes that mutate the `app_state` cookie
 * (`/api/experiences/switch`, `/api/experiences/preferences`,
 * `/api/view/rightbar`).
 *
 * The session cookie is `sameSite: "lax"` (see `sessionOptions`), which lets a
 * third-party page drive a top-level cross-origin POST, so we reject any request
 * whose Origin/Referer host isn't the host we were served on. A request missing
 * BOTH Origin and Referer is rejected too (fail closed): a legitimate
 * same-origin fetch from the app always carries at least a Referer.
 *
 * `requireSession` (default true) adds a defense-in-depth session check for
 * routes with no logged-out caller (switch, rightbar). `/api/experiences/
 * preferences` MUST opt out: theme persistence runs from the root-layout
 * ThemeRegistry on every page, including /login before authentication — a
 * session requirement there 403s every logged-out theme-save.
 *
 * Returns a 403 `NextResponse` to return as-is, or `null` when the request may
 * proceed.
 */
export async function guardAppStateMutation(
  request: NextRequest,
  { requireSession = true }: { requireSession?: boolean } = {}
): Promise<NextResponse | null> {
  const expectedHost = servedHost(request);
  const requestHost =
    hostOf(request.headers.get("origin")) ??
    hostOf(request.headers.get("referer"));

  if (!expectedHost || !requestHost || requestHost !== expectedHost) {
    return forbidden();
  }

  if (requireSession) {
    const session = await getServerSession();
    if (!session) {
      return forbidden();
    }
  }

  return null;
}
