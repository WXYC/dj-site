import React, { useState, useContext } from "react";

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
import { createUser, deleteUser, listUsers, makeAdmin } from "../../../services/station-management/admin-service";
import { toast } from "sonner";
import { PopupContentContext } from "../../../pages/dashboard/Popup";

export const AddDJsPopup = ({callback, style }) => {

    const { closePopup } = useContext(PopupContentContext);
    const [loading, setLoading] = useState(false);

    const handleAddDJ = async (event) => {
        event.preventDefault();
        const { username, password } = event.target.elements;
        
        setLoading(true);
    
        console.log(username.value, password.value);

        setLoading(true);
        (async () => {
          await createUser(username.value, password.value);
          callback();
          setLoading(false);
          closePopup();
        })();
      }

      const handleAddDJs = (event) => {
        event.preventDefault();

        setLoading(true);
        const { usernames, password } = event.target.elements;

        let new_usernames = usernames.value.replace(/\s/g, '').split(',');
        new_usernames = new_usernames.filter((username) => username.length > 0);
        
        (async () => {
          await Promise.allSettled(
            new_usernames.map((username) => createUser(username, password.value))
          );
          callback();
          setLoading(false);
          closePopup();
        })();
      }

    return (
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
          defaultValue={'manual'}
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
}