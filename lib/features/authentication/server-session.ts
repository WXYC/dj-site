import "server-only";
import { cookies } from "next/headers";
import {
  BetterAuthSession,
  SessionReadResult,
  classifySessionRead,
} from "./utilities";
import { getSessionCached } from "./session-cache";

function normalizeSession(session: BetterAuthSession): BetterAuthSession {
  return {
    ...session,
    user: {
      ...session.user,
      username: session.user.username ?? undefined,
    },
  };
}

/**
 * Reads the current session and classifies the outcome: a valid session, a
 * genuinely absent/invalid one, or a read that could not be completed (rate
 * limited, upstream 5xx, or a transport failure). See `SessionReadResult`
 * in ./utilities for what each kind means, and `resolveAuthGate`
 * (server-utils.ts) for how the dashboard layout acts on `unavailable`
 * without redirecting.
 */
export async function getServerSessionResult(): Promise<SessionReadResult> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await getSessionCached(cookieHeader);
  const result = classifySessionRead(response);

  if (result.kind === "session") {
    return { kind: "session", session: normalizeSession(result.session) };
  }

  return result;
}

/**
 * Gets the current session from better-auth in a server component. Returns
 * null for both a genuinely absent session and a failed read — callers that
 * need to tell those apart (currently just the dashboard layout) should use
 * `getServerSessionResult` instead. Kept as-is for the existing callers that
 * predate that distinction, so this function's behavior is unchanged by the
 * `unavailable` classification.
 */
export async function getServerSession(): Promise<BetterAuthSession | null> {
  const result = await getServerSessionResult();
  return result.kind === "session" ? result.session : null;
}
