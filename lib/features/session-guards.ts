import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "./authentication/server-utils";

// The host we were served on, as reported by the edge/proxy. Cloudflare Pages
// (and local dev) set `host`; a fronting proxy may instead set
// `x-forwarded-host`. Deriving the expected origin from the request itself keeps
// the check correct across production, localhost, and per-commit preview deploys
// without hardcoding a host.
function servedHost(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}

function hostOf(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    return new URL(headerValue).host;
  } catch {
    return null;
  }
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Guard for POST routes that mutate the `app_state` cookie
 * (`/api/experiences/switch`, `/api/view/rightbar`).
 *
 * The session cookie is `sameSite: "lax"` (see `sessionOptions`), which lets a
 * third-party page drive a top-level cross-origin POST, so we reject any request
 * whose Origin/Referer host isn't the host we were served on. A request missing
 * BOTH Origin and Referer is rejected too (fail closed): a legitimate
 * same-origin fetch from the app always carries at least a Referer. We also
 * require an authenticated session — neither route has a logged-out caller
 * (see the PR notes), so this adds a defense-in-depth layer without breaking a
 * legitimate flow.
 *
 * Returns a 403 `NextResponse` to return as-is, or `null` when the request may
 * proceed.
 */
export async function guardAppStateMutation(
  request: NextRequest
): Promise<NextResponse | null> {
  const expectedHost = servedHost(request);
  const requestHost =
    hostOf(request.headers.get("origin")) ??
    hostOf(request.headers.get("referer"));

  if (!expectedHost || !requestHost || requestHost !== expectedHost) {
    return forbidden();
  }

  const session = await getServerSession();
  if (!session) {
    return forbidden();
  }

  return null;
}
