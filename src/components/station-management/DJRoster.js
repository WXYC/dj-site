import React, { useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Sheet,
  Stack,
  Tab,
  TabList,
  Table,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/joy";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import SyncLockIcon from "@mui/icons-material/SyncLock";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { Auth } from "aws-amplify";

const DJRoster = ({ style }) => {


  const DJEntry = ({ name, username, djname, shows, isAdmin }) => {
    const [checked, setChecked] = useState(isAdmin);

    return (
      <tr>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <Checkbox
            color={style ?? "success"}
            sx={{ transform: "translateY(3px)" }}
            checked={checked}
            onChange={() => {
              let verify = window.confirm(
                checked
                  ? `Are you sure you want to remove ${name} as an admin?`
                  : `Are you sure you want to make ${name} an admin?`
              );
              if (verify) setChecked(!checked);
            }}
          />
        </td>
        <td>{name}</td>
        <td>{username}</td>
        <td>DJ {djname}</td>
        <td>{shows}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={`Manage ${name}'s Schedule`}
              arrow={true}
              placement="top"
              variant="outlined"
                size="sm"
            >
              <IconButton color={style ?? "success"} variant="solid" size="sm">
                <ManageHistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={`Reset ${name}'s Password`}
              arrow={true}
              placement="top"
              variant="outlined"
              size="sm"
            >
              <IconButton color={style ?? "success"} variant="solid" size="sm">
                <SyncLockIcon />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={`Delete ${name}'s Profile`}
              arrow={true}
              placement="top"
              variant="outlined"
              size='sm'
            >
              <IconButton color="warning" variant="outlined" size="sm">
                <DeleteForeverIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </td>
      </tr>
    );
  };

  return (
    <Sheet
        overflow="auto"
        sx = {{
            width: '100%',
            height: '100%',
            
          "--Table-lastColumnWidth": "120px",
        }}
    >
      <Sheet
        sx={{
          p: 2,
          justifyContent: "flex-end",
          width: "100%",
          display: "flex",
          
          gap: 1,
        }}
      >
        <Button variant="solid" color={style ?? "success"} size="sm">
          Add DJ
        </Button>
      </Sheet>
      <Table
        stripe="odd"
        sx={{
          fontWeight: "sm",
          textAlign: "left",
          "& tr > *:last-child": {
            position: "sticky",
            right: 0,
          },
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: 48,
                verticalAlign: "center",
                textAlign: "center",
              }}
            >
                <Tooltip
                    title="Toggle Admin Status"
                    arrow={true}
                    placement="top"
                    variant="outlined"
                    size="sm"
                >
              <AdminPanelSettingsIcon />
                </Tooltip>
            </th>
            <th>Name</th>
            <th>Username</th>
            <th>DJ Name</th>
            <th>Shows</th>
            <th
              aria-label="last"
              style={{ width: "var(--Table-lastColumnWidth)" }}
            />
          </tr>
        </thead>
        <tbody>
          <DJEntry
            name="John Doe"
            username="jdoe"
            djname="doje"
            shows="The John Doe Show"
            isAdmin={true}
          />
        </tbody>
      </Table>
    </Sheet>
  );
};

export default DJRoster;
