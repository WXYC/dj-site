import { requireEnv } from "./env";

/**
 * Fire BS's POST /internal/flowsheet-sync-notify so it broadcasts a
 * `liveFs:refetch` to every subscribed SSE client. Used by the Tier 3
 * refetch test as the trigger for dj-site's debounced invalidate path
 * (see lib/features/flowsheet/live-updates-listener.ts:243).
 */
export async function triggerFlowsheetSyncNotify(): Promise<void> {
  const env = requireEnv("triggerFlowsheetSyncNotify", [
    "E2E_BACKEND_URL",
    "ETL_NOTIFY_KEY",
  ]);

  const resp = await fetch(`${env.E2E_BACKEND_URL}/internal/flowsheet-sync-notify`, {
    method: "POST",
    headers: { "X-Internal-Key": env.ETL_NOTIFY_KEY },
  });
  if (!resp.ok) {
    throw new Error(
      `POST /internal/flowsheet-sync-notify returned ${resp.status}: ${await resp.text()}`
    );
  }
}
