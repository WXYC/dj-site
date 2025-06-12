import { AuthenticatedUser } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import SettingsPopup from "@/src/components/modern/settings/SettingsPopup";


export default async function SettingsPage() {
      const user = (
        (await createServerSideProps()).authentication as AuthenticatedUser
      ).user!;

      return <SettingsPopup user={user} />;
}