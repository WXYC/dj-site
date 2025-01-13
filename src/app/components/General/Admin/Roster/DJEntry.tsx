"use client";
import { useAppDispatch } from "@/lib/hooks";
import { Authority, User } from "@/lib/models";
import { applicationSlice } from "@/lib/slices/application";
import {
  AdminPanelSettings,
  Album,
  DeleteForever,
  HeadsetMic,
  SyncLock,
} from "@mui/icons-material";
import {
  ColorPaletteProp,
  IconButton,
  Radio,
  radioClasses,
  RadioGroup,
  Sheet,
  Stack,
  Tooltip,
} from "@mui/joy";

export type DJEntryProps = {
  dj: User;
  isSelf: boolean;
  style?: ColorPaletteProp;
};

const DJEntry = (props: DJEntryProps) => {
  const dispatch = useAppDispatch();

  const handleDeleteDJ = () => {
    if (props.isSelf) return;

    dispatch(
      applicationSlice.actions.openPopup(`delete-${props.dj.username}`)
    );
  };

  const handleChangeAdmin = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newAuthority = Number(event.target.value) as Authority;

    if (newAuthority === props.dj.authority) {
      return;
    }

    dispatch(
      applicationSlice.actions.openPopup({
        state: `permissions-${props.dj.username}`,
        payload: newAuthority,
      })
    );
  };

  return (
    <>
      <tr>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <RadioGroup
            value={props.dj.authority}
            onChange={handleChangeAdmin}
            orientation="horizontal"
            sx = {{ gap: 1 }}
          >
            {[Authority.DJ, Authority.MD, Authority.SM].map((authority) => (
              <Sheet
                key={authority}
                sx={{
                  position: "relative",
                  width: 23,
                  height: 23,
                  flexShrink: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  "--joy-focus-outlineOffset": "4px",
                  "--joy-palette-focusVisible": (theme) =>
                    theme.vars.palette.neutral.outlinedBorder,
                  [`& .${radioClasses.checked}`]: {
                    [`& .${radioClasses.label}`]: {
                      fontWeight: "lg",
                    },
                    [`& .${radioClasses.action}`]: {
                      "--variant-borderWidth": "2px",
                      borderColor: "text.secondary",
                    },
                  },
                  [`& .${radioClasses.action}.${radioClasses.focusVisible}`]: {
                    outlineWidth: "2px",
                  },
                }}
              >
                <Tooltip
                  title={(() => {
                    if (props.isSelf)
                      return "You cannot change your own permissions!";

                    switch (authority) {
                      case Authority.DJ:
                        return "DJ";
                      case Authority.MD:
                        return "Music Director";
                      case Authority.SM:
                        return "Station Manager";
                    }
                  })()}
                  arrow={true}
                  placement="top"
                  variant="outlined"
                  size="sm"
                >
                  <Radio
                    color={
                      props.dj.authority === authority ? "neutral" : "success"
                    }
                    overlay
                    disableIcon
                    value={authority}
                    sx={{ pt: 0.5 }}
                    disabled={props.isSelf}
                    label={(() => {
                      switch (authority) {
                        case Authority.DJ:
                          return <Album fontSize="small" />;
                        case Authority.MD:
                          return <HeadsetMic fontSize="small" />;
                        case Authority.SM:
                          return <AdminPanelSettings fontSize="small" />;
                      }
                    })()}
                  />
                </Tooltip>
              </Sheet>
            ))}
          </RadioGroup>
        </td>
        <td>{props.dj.name}</td>
        <td>{props.dj.username}</td>
        <td>
          {(props.dj.djName?.length ?? 0 > 0) && "DJ"} {props.dj.djName}
        </td>
        <td>{props.dj.email}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={
                !props.isSelf
                  ? `Delete ${props.dj.name}${
                      props.dj.name?.length ?? 0 > 0 ? "'s" : ""
                    } Profile`
                  : `You cannot delete yourself!`
              }
              arrow={true}
              placement="top"
              variant="outlined"
              size="sm"
            >
              <IconButton
                color="warning"
                variant="outlined"
                size="sm"
                disabled={props.isSelf}
                onClick={handleDeleteDJ}
              >
                <DeleteForever />
              </IconButton>
            </Tooltip>
          </Stack>
        </td>
      </tr>
    </>
  );
};

export default DJEntry;
