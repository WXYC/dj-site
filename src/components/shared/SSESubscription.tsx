"use client";

import {
  isFlowsheetSSEDashboardEnabled,
  isFlowsheetSSELiveViewEnabled,
} from "@/lib/features/flowsheet/sse-flags";
import { useSSEConnection } from "@/src/hooks/useSSEConnection";

type Surface = "dashboard" | "live";

/**
 * Mountable from server-component layouts/pages. The "use client" boundary is
 * here, not in the host. Returns null in all cases — the value is the
 * ref-count side-effect via `useSSEConnection`.
 *
 * The inner component pattern keeps the `useSSEConnection` call unconditional
 * (rules-of-hooks) while the outer can short-circuit when the surface flag
 * is off.
 */
export default function SSESubscription({ surface }: { surface: Surface }) {
  const enabled =
    surface === "dashboard"
      ? isFlowsheetSSEDashboardEnabled()
      : isFlowsheetSSELiveViewEnabled();
  if (!enabled) return null;
  return <SSESubscriptionInner />;
}

function SSESubscriptionInner() {
  useSSEConnection();
  return null;
}
