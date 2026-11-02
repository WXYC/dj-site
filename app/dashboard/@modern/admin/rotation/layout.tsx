import type { JSX } from "react";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import { Authorization } from "@/lib/features/admin/types";
import { notFound } from "next/navigation";

// The pages remain the authority on access: every rotation page repeats the
// flag + MD checks, because a layout does NOT re-run on soft navigation
// between its child routes. The layout runs both itself as well, so nothing
// it renders now or later can stream ahead of a page's gate to a requester
// (DJ, anonymous, flag-off) who will be turned away.
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

  return <>{children}</>;
}
