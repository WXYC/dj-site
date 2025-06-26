import { AuthenticatedUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import PageHeader from "@/src/components/modern/Header/PageHeader";
import RosterTable from "@/src/components/modern/admin/roster/RosterTable";

export default async function AdminPage() {
  const user = (
    (await createServerSideProps()).authentication as AuthenticatedUser
  ).user!;
  return (
    <>
      <PageHeader title="DJ Roster" />
      <>
        <RosterTable user={user} />
      </>
    </>
  );
}
