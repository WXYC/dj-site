import { DJ, adminSlice, applicationSlice, fetchDJs, makeStationManager, populateStationManagers, removeStationManager, removeDJ, useDispatch, AdminType, makeMusicDirector, populateMusicDirectors, removeMusicDirector } from "@/lib/redux";
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

    const appointStationManager = (dj: DJ) => {
      dispatch(makeStationManager(dj)).then(() => {
        dispatch(populateStationManagers());
      });
    };
    const demoteStationManager = (dj: DJ) => {
      dispatch(removeStationManager(dj)).then(() => {
        dispatch(populateStationManagers());
      });
    };

    const appointMusicDirector = (dj: DJ) => {
      dispatch(makeMusicDirector(dj)).then(() => {
        dispatch(populateMusicDirectors());
      });
    };
    const demoteMusicDirector = (dj: DJ) => {
      dispatch(removeMusicDirector(dj)).then(() => {
        dispatch(populateMusicDirectors());
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
                  dispatch(populateStationManagers());
                });
              });
            })();
          }}
          style="success"
        />
      );
    };

    const handleChangeStationManager = () => {
        openPopup(
          <ConfirmPopup
            message={(props.dj.adminType == AdminType.StationManager) ? 
              `Are you sure you want to remove admin privileges for ${((props.dj.realName.length > 0) ? props.dj.realName : null) ?? props.dj.userName ?? 'this account'}?` : 
              `Are you sure you want to grant admin privileges for ${((props.dj.realName.length > 0) ? props.dj.realName : null) ?? props.dj.userName ?? 'this account'}?`}
            onConfirm={() => { ((props.dj.adminType == AdminType.StationManager) ? demoteStationManager(props.dj) : appointStationManager(props.dj))}}
            style="success"
          />
        )
    };

    const handleChangeMusicDirector = () => {
      openPopup(
        <ConfirmPopup
          message={(props.dj.adminType == AdminType.MusicDirector) ? 
            `Are you sure you want to remove music director privileges for ${((props.dj.realName.length > 0) ? props.dj.realName : null) ?? props.dj.userName ?? 'this account'}?` : 
            `Are you sure you want to grant music director privileges for ${((props.dj.realName.length > 0) ? props.dj.realName : null) ?? props.dj.userName ?? 'this account'}?`}
          onConfirm={() => { ((props.dj.adminType == AdminType.MusicDirector) ? demoteMusicDirector(props.dj) : appointMusicDirector(props.dj))}}
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
            checked={props.dj.adminType == AdminType.StationManager}
            onChange={handleChangeStationManager}
          />
        </td>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <Checkbox
            disabled = {props.isSelf || props.dj.adminType == AdminType.StationManager}
            color={props.style ?? "success"}
            sx={{ transform: "translateY(3px)" }}
            checked={props.dj.adminType == AdminType.StationManager || props.dj.adminType == AdminType.MusicDirector}
            onChange={handleChangeMusicDirector}
          />
        </td>
        <td>{props.dj.realName}</td>
        <td>{props.dj.userName}</td>
        <td>{(props.dj.djName.length > 0) && 'DJ'} {props.dj.djName}</td>
        <td>{props.dj.email}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
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