"use client";

import { useEffect, useState } from "react";
import type { StationSignupAttempts } from "@/lib/features/station-signup/types";

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * The one attempt outcome that arms the refusal hold. Every other failure
 * outcome is exempt from refusal, so none of them moves the lift time -- a
 * burst of exhausted-code or already-refused attempts must not appear to
 * extend a cooldown it cannot extend.
 */
const HOLD_ARMING_OUTCOME = "passcode_fail";

/**
 * When the cooldown lifts on its own, as epoch milliseconds, or null when the
 * attempt log carries no arming failure to anchor on.
 *
 * The status payload states the hold duration, not a deadline, so the deadline
 * has to be derived: an arming failure inside a qualifying burst re-arms the
 * hold, which means the newest one carries it. `recent` is a newest-first
 * display list capped server-side, so this takes the maximum rather than
 * trusting position; a cooldown old enough to have pushed its arming failure
 * off the end of that list yields null, and the caller falls back to stating
 * the hold duration.
 */
export function cooldownLiftsAtMs(attempts: StationSignupAttempts, holdMinutes: number): number | null {
  let newestArmingFailure: number | null = null;
  for (const attempt of attempts.recent) {
    if (attempt.outcome !== HOLD_ARMING_OUTCOME) continue;
    const attemptedAt = Date.parse(attempt.attemptedAt);
    if (Number.isNaN(attemptedAt)) continue;
    if (newestArmingFailure === null || attemptedAt > newestArmingFailure) {
      newestArmingFailure = attemptedAt;
    }
  }
  if (newestArmingFailure === null) return null;
  return newestArmingFailure + holdMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
}

/**
 * A remaining span as "1h 04m" / "12m 30s" / "45s". Seconds round up so the
 * label reads as time still to wait rather than flicking to the next value
 * down a fraction of a second early; a non-positive span reads "0s".
 */
export function formatHoldRemaining(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / MS_PER_SECOND));
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;

  const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
  if (minutes >= MINUTES_PER_HOUR) {
    const wholeHours = Math.floor(minutes / MINUTES_PER_HOUR);
    return `${wholeHours}h ${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}m`;
  }

  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m ${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}s`;
}

/**
 * Server time in epoch milliseconds, ticking between status refreshes.
 *
 * The absolute instant always comes from the server's own clock: a browser
 * clock skewed by minutes would otherwise show a countdown that disagrees with
 * the service enforcing the hold. The browser clock is read only for elapsed
 * time since the anchor arrived, and only on a tick -- the value on the render
 * that receives a fresh `serverNowIso` is exactly that instant, unadjusted.
 *
 * `tickMs` of null keeps the clock still, for when nothing on screen is
 * counting down.
 */
export function useServerClockMs(serverNowIso: string | undefined, tickMs: number | null): number | null {
  const parsed = serverNowIso ? Date.parse(serverNowIso) : Number.NaN;
  const serverMs = Number.isNaN(parsed) ? null : parsed;

  const [clockMs, setClockMs] = useState<number | null>(serverMs);
  const [anchoredOn, setAnchoredOn] = useState<number | null>(serverMs);
  if (anchoredOn !== serverMs) {
    setAnchoredOn(serverMs);
    setClockMs(serverMs);
  }

  // The browser clock is outside React, so it is read here rather than during
  // render -- and only as an origin to measure elapsed time against.
  useEffect(() => {
    if (serverMs === null || tickMs === null) return;
    const startedAt = Date.now();
    const id = setInterval(() => setClockMs(serverMs + (Date.now() - startedAt)), tickMs);
    return () => clearInterval(id);
  }, [serverMs, tickMs]);

  return clockMs;
}

/**
 * Prose for the outcome tokens a manager reads most often. Deliberately
 * partial: the attempt log gains outcomes without a frontend deploy, so an
 * unmapped token is rendered rather than dropped.
 */
const OUTCOME_LABELS: Record<string, string> = {
  passcode_ok: "Accepted",
  passcode_fail: "Failed match",
  passcode_exhausted: "Code exhausted",
  passcode_expired: "Code expired",
  passcode_revoked: "Code revoked",
  cooldown_refused: "Refused in cooldown",
  cooldown_cleared: "Cooldown cleared",
  passcode_revealed: "Revealed",
  passcode_rotated: "Rotated",
  passcode_unverifiable: "Code unverifiable",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome.replace(/_/g, " ");
}

/**
 * True for the outcomes that mean an attempt was turned away, which the census
 * highlights. `passcode_unverifiable` is the loudest of these: it means the
 * gate refused because an active code would not decrypt (key trouble), not
 * because the DJ typed anything wrong. `passcode_expired`/`passcode_revoked`
 * are turned-away attempts too -- a spike in either means someone is retrying
 * a dead code.
 */
export function isRefusedOutcome(outcome: string): boolean {
  return (
    outcome === "passcode_fail" ||
    outcome === "cooldown_refused" ||
    outcome === "passcode_exhausted" ||
    outcome === "passcode_unverifiable" ||
    outcome === "passcode_expired" ||
    outcome === "passcode_revoked"
  );
}

export type OutcomeCount = { outcome: string; label: string; count: number };

/**
 * The window-wide census, ordered loudest first so a brute-force ramp reads off
 * the front. Built only from `countsByOutcome` -- `recent` is a capped display
 * list, and counting it would silently understate any window busier than the
 * cap.
 */
export function outcomeCensus(countsByOutcome: Record<string, number>): OutcomeCount[] {
  return Object.entries(countsByOutcome)
    .map(([outcome, count]) => ({ outcome, label: outcomeLabel(outcome), count }))
    .sort((a, b) => b.count - a.count || a.outcome.localeCompare(b.outcome));
}
