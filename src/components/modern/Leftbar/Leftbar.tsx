import { Authorization } from "@/lib/features/admin/types";
import { canManageUsers, hasMinimumRole } from "@/lib/features/authentication/types";
import { AuthenticatedUser } from "@/lib/features/authentication/types";
import { getServerSideProps } from "@/lib/features/authentication/session";
import { EditCalendar, ManageAccounts } from "@mui/icons-material";
import AlbumIcon from "@mui/icons-material/Album";
import SettingsIcon from "@mui/icons-material/Settings";
import StorageIcon from "@mui/icons-material/Storage";
import Divider from "@mui/joy/Divider";
import List from "@mui/joy/List";
import FlowsheetLink from "./FlowsheetLink";
import LeftbarContainer from "./LeftbarContainer";
import LeftbarLink from "./LeftbarLink";
import LeftbarLogout from "./LeftbarLogout";

export default async function Leftbar(): Promise<JSX.Element> {
  // user is guaranteed to be defined here because middleware will redirect to login if not authenticated
  const user = (
(await getServerSideProps()).authentication as AuthenticatedUser
  ).user!;

  return (
    <LeftbarContainer>
      <List sx={{ "--ListItem-radius": "8px", "--List-gap": "12px" }}>
        <LeftbarLink path="/dashboard/catalog" title="Card Catalog">
          <AlbumIcon />
        </LeftbarLink>
        <FlowsheetLink />
        <LeftbarLink
          path="/dashboard/playlists"
          title="Previous Sets"
          disabled={true}
        >
          <StorageIcon />
        </LeftbarLink>
        {user && hasMinimumRole(user, "music-director") && (
          <>
            <Divider sx={{ mt: 1.5 }} />
            <LeftbarLink
              path="/dashboard/admin/roster"
              title="DJ Roster"
              disabled={!canManageUsers(user)}
            >
              <ManageAccounts />
            </LeftbarLink>
            <LeftbarLink
              path="/dashboard/admin/schedule"
              title="Station Schedule"
              disabled={true}
            >
              <EditCalendar />
            </LeftbarLink>
          </>
        )}
      </List>
      <LeftbarLink path="/dashboard/settings" title="Settings">
        <SettingsIcon />
      </LeftbarLink>
      <Divider />
      <LeftbarLogout user={user} />
    </LeftbarContainer>
  );
}
