import { AuthenticatedUser, canManageUsers } from "@/lib/features/authentication/types";
import { getServerSideProps } from "@/lib/features/authentication/session";
import PageHeader from "@/src/components/modern/Header/PageHeader";
import RosterTable from "@/src/components/modern/admin/roster/RosterTable";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const serverSideProps = await getServerSideProps();
  
  if (!serverSideProps.authentication) {
    redirect("/login");
  }
  
  const user = (serverSideProps.authentication as AuthenticatedUser).user!;
  
  // Check if user has admin privileges
  if (!canManageUsers(user)) {
    redirect("/dashboard/catalog"); // Redirect to a safe page
  }
  return (
    <>
      <PageHeader title="DJ Roster" />
      <>
        <RosterTable user={user} />
      </>
    </>
  );
}
