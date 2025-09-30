import { AuthenticatedUser } from "@/lib/features/authentication/types";
import { getServerSideProps } from "@/lib/features/authentication/session";
import SettingsPopup from "@/src/components/modern/settings/SettingsPopup";


export default async function SettingsPage() {
      const serverSideProps = await getServerSideProps();
      const user = serverSideProps.authentication?.user!;

      return <SettingsPopup user={user} />;
}