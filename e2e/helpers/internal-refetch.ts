/**
 * Fire BS's POST /internal/flowsheet-sync-notify so it broadcasts a
 * `liveFs:refetch` to every subscribed SSE client. Used by the Tier 3
 * refetch test as the trigger for dj-site's debounced invalidate path
 * (see lib/features/flowsheet/live-updates-listener.ts:243).
 *
 * Env from scripts/e2e-local.sh / the E2E workflow:
 *   E2E_BACKEND_URL — the BS origin (e.g. http://localhost:8085)
 *   ETL_NOTIFY_KEY  — shared secret BS uses to authenticate internal callers
 */
export async function triggerFlowsheetSyncNotify(): Promise<void> {
  const backend = process.env.E2E_BACKEND_URL;
  const key = process.env.ETL_NOTIFY_KEY;
  const missing: string[] = [];
  if (!backend) missing.push("E2E_BACKEND_URL");
  if (!key) missing.push("ETL_NOTIFY_KEY");
  if (missing.length > 0) {
    throw new Error(
      `triggerFlowsheetSyncNotify: missing env: ${missing.join(", ")}. ` +
        `Ensure scripts/e2e-local.sh (or the CI workflow) exports them before running Playwright.`
    );
  }

  const resp = await fetch(`${backend}/internal/flowsheet-sync-notify`, {
    method: "POST",
    headers: { "X-Internal-Key": key! },
  });
  if (!resp.ok) {
    throw new Error(
      `POST /internal/flowsheet-sync-notify returned ${resp.status}: ${await resp.text()}`
    );
  }
}
