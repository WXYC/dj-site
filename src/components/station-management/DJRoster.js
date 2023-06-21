import React, { useContext, useEffect, useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import { createUser, deleteUser, listUsers, makeAdmin } from "../../services/station-management/admin-service";
import { toast } from "sonner";

const DJRoster = ({ user, style }) => {

  const { openPopup, closePopup } = useContext(PopupContentContext);

  const [loading, setLoading] = useState(true);

  const [djs, setDjs] = useState([]);

  useEffect(() => {
    setLoading(true);
    listUsers().then((data) => {
      console.log(user);
      setDjs(data);
      setLoading(false);
    });
  }, []);

  const DJEntry = ({ name, username, djname, shows, isAdmin, isSelf }) => {
    const [checked, setChecked] = useState(isAdmin);

    const handleDeleteDJ = () => {
      let verify = window.confirm(`Are you sure you want to delete ${((name?.length > 0) ? name : null) ?? username ?? 'this account'}?`);
      if (!verify) return;

      (async () => {
        setLoading(true);
        await deleteUser(username);
        setDjs(await listUsers());
        setLoading(false);
      })();
    };

    const handleChangeAdmin = () => {
        let verify = window.confirm(
          checked
            ? `Are you sure you want to remove ${((name?.length > 0) ? name : null) ?? username ?? 'this account'} as a station manager?`
            : `Are you sure you want to grant ${((name?.length > 0) ? name : null) ?? username ?? 'this account'} a station management account?`
        );
        if (!verify) return;

      if (checked) {
        makeAdmin(username);
        setChecked(false);
      } else {
        makeAdmin(username);
        setChecked(true);
      }
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
            disabled = {isSelf}
            color={style ?? "success"}
            sx={{ transform: "translateY(3px)" }}
            checked={checked}
            onChange={handleChangeAdmin}
          />
        </td>
        <td>{name}</td>
        <td>{username}</td>
        <td>{(djname.length > 0) && 'DJ'} {djname}</td>
        <td>{shows}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={`Manage ${name}${(name.length > 0)? "'s" : ''} Schedule`}
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
              title={`Reset ${name}${(name.length > 0)? "'s" : ''} Password`}
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
              title={(!isSelf) ? `Delete ${name}${(name.length > 0)? "'s" : ''} Profile` : `You cannot delete yourself!`}
              arrow={true}
              placement="top"
              variant="outlined"
              size='sm'
            >
              <IconButton color="warning" variant="outlined" size="sm"
                disabled = {isSelf}
                onClick={handleDeleteDJ}
              >
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
        <Button
          variant="outlined"
          color={style ?? "success"}
          size="sm"
        >
          Export Roster as CSV
        </Button>
        <Button variant="solid" color={style ?? "success"} size="sm"
          onClick = {
            () => {
              const handleAddDJ = async (event) => {
                event.preventDefault();
                const { username, password } = event.target.elements;
                
                openPopup(addForms(true));
            
                console.log(username.value, password.value);

                setLoading(true);
                (async () => {
                  await createUser(username.value, password.value);
                  setDjs(await listUsers());
                  setLoading(false);
                  closePopup();
                })();
              }

              const handleAddDJs = (event) => {
                event.preventDefault();

                openPopup(addForms(true, true));
                const { usernames, password } = event.target.elements;

                let new_usernames = usernames.value.replace(/\s/g, '').split(',');
                new_usernames = new_usernames.filter((username) => username.length > 0);
                
                (async () => {
                  await Promise.allSettled(
                    new_usernames.map((username) => createUser(username, password.value))
                  );
                  setDjs(await listUsers());
                  setLoading(false);
                  closePopup();
                })();
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
          {(loading) ? (
            <tr
              style={{ background: 'transparent' }}
            >
            <td colSpan={6} style={{ textAlign: "center", paddingTop: '2rem' }}>
              <CircularProgress color={style ?? "success" } />
            </td>
            </tr>
          ) : (djs.map((dj) => (
            <DJEntry
              key={dj.username}
              name={dj.name}
              username={dj.username}
              djname={dj.djName}
              shows={dj.shows || 'Not Scheduled'}
              isAdmin={dj.isAdmin}
              isSelf={dj.username === user.Username}
            />
          )))}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default DJRoster;
