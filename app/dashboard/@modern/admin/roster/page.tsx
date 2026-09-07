import { requireAuth, requireRole, getUserFromSession } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import RosterViewSwitcher from "@/src/components/experiences/modern/admin/roster/RosterViewSwitcher";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("DJ Roster"),
};

export default async function AdminPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.SM);

  const user = await getUserFromSession(session);
  const organizationSlug = process.env.NEXT_PUBLIC_APP_ORGANIZATION || "";

  return (
    <>
      <PageHeader title="DJ Roster" />
      <RosterViewSwitcher user={user} organizationSlug={organizationSlug} />
    </>
  );
}
