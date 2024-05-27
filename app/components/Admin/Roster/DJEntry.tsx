import { DJ, applicationSlice } from "@/lib/redux";
import { ConfirmPopup } from "../../General/Popups/Popups";
import { Checkbox, ColorPaletteProp, IconButton, Stack, Tooltip } from "@mui/joy";
import { DeleteForever, ManageHistory, SyncLock } from "@mui/icons-material";
import { ResetPasswordPopup } from "../Popups/ResetPasswordPopup";

export type DJEntryProps = {
    name: string;
    username: string;
    djname: string;
    shows?: string;
    isAdmin: boolean;
    isSelf: boolean;
    style?: ColorPaletteProp;
  };

const DJEntry = (props: DJEntryProps) => {

    
    const openPopup = applicationSlice.actions.openPopup;

    const handleDeleteDJ = () => {
      openPopup(
        <ConfirmPopup
          message={`Are you sure you want to delete ${((props.name?.length > 0) ? props.name : null) ?? props.username ?? 'this account'}?`}
          onConfirm={() => {
            (async () => {
              //await deleteUser(username);
            })();
          }}
        />
      );
    };

    const handleChangeAdmin = () => {
        openPopup(
          <ConfirmPopup
            message={(props.isAdmin) ? 
              `Are you sure you want to remove admin privileges for ${((props.name?.length > 0) ? props.name : null) ?? props.username ?? 'this account'}?` : 
              `Are you sure you want to grant admin privileges for ${((props.name?.length > 0) ? props.name : null) ?? props.username ?? 'this account'}?`}
            onConfirm={() => { ((props.isAdmin) ? /* removeAdmin(props.username) */ console.warn('REMOVE ADMIN') : /* makeAdmin(props.username) */console.warn("MAKE ADMIN"))}}
          />
        )
    };

    return (
      <tr>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <Checkbox
            disabled = {props.isSelf}
            color={props.style ?? "success"}
            sx={{ transform: "translateY(3px)" }}
            checked={props.isAdmin}
            onChange={handleChangeAdmin}
          />
        </td>
        <td>{props.name}</td>
        <td>{props.username}</td>
        <td>{(props.djname.length > 0) && 'DJ'} {props.djname}</td>
        <td>{props.shows}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={`Manage ${props.name}${(props.name.length > 0)? "'s" : ''} Schedule`}
              arrow={true}
              placement="top"
              variant="outlined"
                size="sm"
            >
              <IconButton color={props.style ?? "success"} variant="solid" size="sm">
                <ManageHistory />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={`Reset ${props.name}${(props.name.length > 0)? "'s" : ''} Password`}
              arrow={true}
              placement="top"
              variant="outlined"
              size="sm"
            >
              <IconButton color={props.style ?? "success"} variant="solid" size="sm"
                onClick={() => {
                  openPopup(
                    <ResetPasswordPopup message={props.username} />
                  )
                }}
              >
                <SyncLock />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={(!props.isSelf) ? `Delete ${props.name}${(props.name.length > 0)? "'s" : ''} Profile` : `You cannot delete yourself!`}
              arrow={true}
              placement="top"
              variant="outlined"
              size='sm'
            >
              <IconButton color="warning" variant="outlined" size="sm"
                disabled = {props.isSelf}
                onClick={handleDeleteDJ}
              >
                <DeleteForever />
              </IconButton>
            </Tooltip>
          </Stack>
        </td>
      </tr>
    );
  };

export default DJEntry;