import { AuthenticatedUser } from "@/lib/features/authentication/types";
import { getServerSideProps } from "@/lib/features/authentication/session";
import PageHeader from "@/src/components/modern/Header/PageHeader";
import RosterTable from "@/src/components/modern/admin/roster/RosterTable";

export default async function AdminPage() {
  const user = (
(await getServerSideProps()).authentication as AuthenticatedUser
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
