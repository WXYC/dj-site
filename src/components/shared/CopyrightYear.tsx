"use client";

/**
 * The current year, resolved at request time rather than during a prerender.
 *
 * A prerendered shell has no "now": reading the clock there would freeze the
 * build's year into the static HTML and serve a stale copyright every January.
 * Keeping the read on the client is also what lets the surrounding route
 * prerender at all — synchronous clock access inside the server shell fails the
 * Cache Components prerender outright, and no segment-level opt-out clears it.
 */
export default function CopyrightYear() {
  return <>{new Date().getFullYear()}</>;
}
