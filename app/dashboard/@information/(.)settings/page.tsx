import { getServerSideProps } from "@/lib/features/authentication/session";
import SettingsPopup from "@/src/components/modern/settings/SettingsPopup";
import { redirect } from "next/navigation";


export default async function SettingsPage() {
      const serverSideProps = await getServerSideProps();
      
      // Ensure user is authenticated to access settings
      if (!serverSideProps.authentication) {
        redirect("/login");
      }
      
      const user = serverSideProps.authentication.user;

      return <SettingsPopup user={user} />;
}