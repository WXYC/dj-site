/**
 * Feature flags for Live Updates (per CONTEXT.md vocabulary). "Live updates"
 * is the feature — real-time UI refresh when the flowsheet changes. SSE is
 * the v0 transport that delivers them. Future transports (BroadcastChannel,
 * SharedWorker) would still be gated by these same flags; the file is named
 * after the v0 transport because that's the load-bearing detail for now.
 *
 * Two flags so dashboards (small, known audience) can roll out before /live
 * (unknown public audience). See docs/live-updates-sse.md.
 *
 * Values are inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init.
 */

export function isFlowsheetSSEDashboardEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED;
  return v === "true" || v === "1";
}

export function isFlowsheetSSELiveViewEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED;
  return v === "true" || v === "1";
}
