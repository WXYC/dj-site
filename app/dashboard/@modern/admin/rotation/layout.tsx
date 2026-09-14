import type { JSX } from "react";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import { Authorization } from "@/lib/features/admin/types";
import { notFound } from "next/navigation";
import RotationTabs from "@/src/components/experiences/modern/admin/rotation/RotationTabs";

// The pages remain the authority on access: every rotation page repeats the
// flag + MD checks. The layout must still run both itself, for two reasons
// that cut in opposite directions. A layout flushes to the stream before any
// page gate resolves, so an ungated tab strip would disclose the
// dark-launched surface's names and URLs to every requester (DJ, anonymous,
// flag-off) ahead of the page's redirect. And a layout does NOT re-run on
// soft navigation between its child routes, so this check alone could never
// replace the per-page gates.
export default async function RotationAdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  if (!isRotationAdminEnabled()) {
    notFound();
  }

  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <>
      <RotationTabs />
      {children}
    </>
  );
}
