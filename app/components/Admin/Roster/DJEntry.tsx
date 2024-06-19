import { DJ, adminSlice, applicationSlice, fetchDJs, makeAdmin, populateAdmins, removeAdmin, removeDJ, scheduleSlice, useDispatch } from "@/lib/redux";
import { ConfirmPopup } from "../../General/Popups/Popups";
import { Checkbox, ColorPaletteProp, IconButton, Stack, Tooltip } from "@mui/joy";
import { DeleteForever, ManageHistory, SyncLock } from "@mui/icons-material";
import { ResetPasswordPopup } from "../Popups/ResetPasswordPopup";
import { useRouter } from "next/navigation";

export type DJEntryProps = {
    dj: DJ;
    isSelf: boolean;
    style?: ColorPaletteProp;
  };

const DJEntry = (props: DJEntryProps) => {

    const dispatch = useDispatch();

    const router = useRouter();
    
    const openPopup = (content: JSX.Element) => dispatch(applicationSlice.actions.openPopup(content));

    const appointAdmin = (dj: DJ) => {
      dispatch(makeAdmin(dj)).then(() => {
        dispatch(populateAdmins());
      });
    };
    const demoteAdmin = (dj: DJ) => {
      dispatch(removeAdmin(dj)).then(() => {
        dispatch(populateAdmins());
      });
    };


    const handleDeleteDJ = () => {
      openPopup(
        <ConfirmPopup
          message={`Are you sure you want to delete ${props.dj.realName} (@${props.dj.userName})?`}
          onConfirm={() => {
            (async () => {
              dispatch(removeDJ(props.dj)).then(() => {
                dispatch(fetchDJs()).then(() => {
                  dispatch(populateAdmins());
                });
              });
            })();
          }}
          style="success"
        />
      );
    };

    const handleChangeAdmin = () => {
        openPopup(
          <ConfirmPopup
            message={(props.dj.isAdmin) ? 
              `Are you sure you want to remove admin privileges for ${((props.dj.realName.length > 0) ? props.dj.realName : null) ?? props.dj.userName ?? 'this account'}?` : 
              `Are you sure you want to grant admin privileges for ${((props.dj.realName.length > 0) ? props.dj.realName : null) ?? props.dj.userName ?? 'this account'}?`}
            onConfirm={() => { ((props.dj.isAdmin) ? demoteAdmin(props.dj) : appointAdmin(props.dj))}}
            style="success"
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
            checked={props.dj.isAdmin}
            onChange={handleChangeAdmin}
          />
        </td>
        <td>{props.dj.realName}</td>
        <td>{props.dj.userName}</td>
        <td>{(props.dj.djName.length > 0) && 'DJ'} {props.dj.djName}</td>
        <td>{props.dj.shows}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={`Manage ${props.dj.realName}${(props.dj.realName.length > 0)? "'s" : ''} Schedule`}
              arrow={true}
              placement="top"
              variant="outlined"
                size="sm"
            >
              <IconButton color={props.style ?? "success"} variant="solid" size="sm"
                onClick={() => {
                  dispatch(scheduleSlice.actions.setForDJ(props.dj));
                  router.push("/admin/schedule");
                }}
              >
                <ManageHistory />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={`Reset ${props.dj.realName}${(props.dj.realName.length > 0)? "'s" : ''} Password`}
              arrow={true}
              placement="top"
              variant="outlined"
              size="sm"
            >
              <IconButton color={props.style ?? "success"} variant="solid" size="sm"
                onClick={() => {
                  openPopup(
                    <ResetPasswordPopup dj={props.dj} />
                  )
                }}
              >
                <SyncLock />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={(!props.isSelf) ? `Delete ${props.dj.realName}${(props.dj.realName.length > 0)? "'s" : ''} Profile` : `You cannot delete yourself!`}
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