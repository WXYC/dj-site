import React, { useContext, useEffect, useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Sheet,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Table,
  Tabs,
  Textarea,
  Tooltip,
  Typography,
} from "@mui/joy";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import SyncLockIcon from "@mui/icons-material/SyncLock";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { PopupContentContext } from "../../pages/dashboard/Popup";
import { listUsers } from "../../services/station-management/adminRosterFunctions";

const DJRoster = ({ style }) => {

  const { openPopup, closePopup } = useContext(PopupContentContext);

  useEffect(() => {
    listUsers();
  }, []);

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
        <Button variant="solid" color={style ?? "success"} size="sm"
          onClick = {
            () => {
              const handleAddDJ = async (event) => {
                event.preventDefault();
                const { username, password } = event.target.elements;
                
                openPopup(addForms(true));
            
                console.log(username.value, password.value);

                // await adminCreateUser(username.value, password.value);

                closePopup();
              }

              const handleAddDJs = (event) => {
                event.preventDefault();

                openPopup(addForms(true, true));
                const { list } = event.target.elements;
                console.log(list?.value);
              }

              const addForms = (loading, secondTab = false) => (

                <Sheet
                  sx = {{
                    minWidth: {
                      xs: 'unset',
                      sm: '400px',
                      md: '600px',
                    }
                  }}
                >
                <Box sx={{ p: 2 }}>
                  <Typography level="h1">Add DJs</Typography>
                </Box>
                  <Tabs
                    sx={{ mt: 2 }}
                    defaultValue={secondTab ? "list" : "manual"}
                    indicatorColor={style ?? "success"}
                    textColor={style ?? "success"}
                  >
                  <TabList>
                    <Tab value="manual">Add Manually</Tab>
                    <Tab value="list">Add By List</Tab>
                  </TabList>
                  <TabPanel value="manual">
                    <form
                      onSubmit = {handleAddDJ}
                    >
                      <Stack spacing={2} sx = {{ p: 2 }}>
                        <FormControl required>
                          <FormLabel>Username</FormLabel>
                          <Typography level = "body3" sx = {{ my: 0.5 }}>
                            This will be the username that the DJ uses to log in. It must be unique and cannot be changed. <br />
                            We recommend using the DJ's first name, last name, initials, or some combination of the three.
                          </Typography>
                          <Input
                            placeholder="username"
                            name = "username"
                          />
                        </FormControl>
                        <FormControl required>
                          <FormLabel>Temporary Password</FormLabel>
                          <Typography level = "body3" sx = {{ my: 0.5 }}>
                            This password will be used to log in for the first time. The DJ will be prompted to change it upon logging in. <br />
                            <Typography color="primary">
                              Must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.
                            </Typography>
                          </Typography>
                          <Input
                            placeholder="password"
                            name = "password"
                          />
                        </FormControl>
                        <FormControl>
                          <Button
                            variant="solid"
                            color={style ?? "success"}
                            size="lg"
                            loading={loading}
                            type="submit"
                            sx = {{ my: 2, ml: 'auto' }}
                          >
                            Create New Account
                          </Button>
                        </FormControl>
                      </Stack>
                    </form>
                  </TabPanel>
                  <TabPanel value="list">
                    <form
                      onSubmit = {handleAddDJs}
                    >
                      <Stack spacing={2} sx = {{ p: 2 }}>
                        <FormControl required>
                          <FormLabel>Enter List</FormLabel>
                          <Typography level = "body3" sx = {{ my: 0.5 }}>
                            Enter a list of usernames, separated by <Typography color="primary">commas.</Typography> <br />
                            The usernames must be unique and cannot be changed. <br />
                            We recommend using the DJ's first name, last name, initials, or some combination of the three.
                          </Typography>
                          <Textarea
                            placeholder="username"
                            name = "usernames"
                            sx = {{ height: '100px' }}
                          />
                        </FormControl>
                        <FormControl required>
                          <FormLabel>Temporary Password</FormLabel>
                          <Typography level = "body3" sx = {{ my: 0.5 }}>
                            This password will be used to log in for the first time. The DJs will be prompted to change it upon logging in. <br />
                            <Typography color="primary">
                              Must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.
                            </Typography>
                          </Typography>
                          <Input
                            placeholder="password"
                            name = "password"
                          />
                        </FormControl>
                        <FormControl>
                          <Button
                            variant="solid"
                            color={style ?? "success"}
                            size="lg"
                            loading={loading}
                            type="submit"
                            sx = {{ my: 2, ml: 'auto' }}
                          >
                            Create New Accounts
                          </Button>
                        </FormControl>
                      </Stack>
                    </form>
                  </TabPanel>
                  </Tabs>
                  </Sheet>
              ) 

              openPopup(
                addForms(false)
              );
            }
          }
        >
          Add DJs
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
