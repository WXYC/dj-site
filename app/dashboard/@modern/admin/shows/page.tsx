import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import OpenShowsTable from "@/src/components/experiences/modern/admin/shows/OpenShowsTable";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Open Shows"),
};

export default async function OpenShowsAdminPage() {
  const session = await requireAuth();
  // MD, not SM: the backend gates both open-shows routes at
  // `flowsheet: manage`, which musicDirector and stationManager hold. The
  // server enforces the role on every request regardless — this gate only
  // keeps the page from rendering an all-refusals surface.
  await requireRole(session, Authorization.MD);

  return (
    <>
      <PageHeader title="Open Shows" />
      <OpenShowsTable />
    </>
  );
}
