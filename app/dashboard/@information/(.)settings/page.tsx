import { requireAuth, getUserFromSession } from "@/lib/features/authentication/server-utils";
import SettingsPopup from "@/src/components/experiences/modern/settings/SettingsPopup";


export default async function SettingsPage() {
      const session = await requireAuth();
      const user = await getUserFromSession(session);

      return <SettingsPopup user={user} />;
}
