/**
 * Auto-DJ status feature gate.
 *
 * The status indicator (greyscale + banner) only runs when the orchestrator URL
 * is configured. Read at render time — `NEXT_PUBLIC_*` is inlined at build time.
 */
export function getOrchestratorUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL;
  return url && url.length > 0 ? url : undefined;
}

export function isAutoDJStatusEnabled(): boolean {
  return getOrchestratorUrl() !== undefined;
}
